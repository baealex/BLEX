from __future__ import annotations

import logging
from dataclasses import dataclass

from django.contrib.auth.models import AnonymousUser, User
from django.db import IntegrityError, transaction
from django.utils.translation import gettext

from board.models import AuthorSubscription, AuthorSubscriptionLog, Post
from board.modules.response import ErrorCode
from board.modules.time import convert_to_localtime
from board.services.authoring_permission_service import AuthoringPermissionService
from board.services.integration_setting_service import IntegrationSettingService
from board.services.notification_creation_service import NotificationCreationService
from board.services.notification_message_service import NotificationMessageKey
from board.services.public_post_service import PublicPostService
from modules.sub_task import SubTaskProcessor


logger = logging.getLogger(__name__)


class AuthorSubscriptionError(Exception):
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class AuthorSubscriptionState:
    can_subscribe: bool
    is_subscribed: bool

    def to_dict(self) -> dict[str, bool]:
        return {
            'can_subscribe': self.can_subscribe,
            'is_subscribed': self.is_subscribed,
        }


class AuthorSubscriptionService:
    """Let readers follow authors and hear about their new posts."""

    @staticmethod
    def is_subscribable_author(author: User) -> bool:
        return AuthoringPermissionService.is_active_editor(author)

    @staticmethod
    def get_state(
        viewer: User | AnonymousUser,
        author: User,
    ) -> AuthorSubscriptionState:
        can_subscribe = (
            AuthorSubscriptionService.is_subscribable_author(author)
            and viewer != author
        )
        is_subscribed = (
            can_subscribe
            and viewer.is_authenticated
            and AuthorSubscription.objects.filter(
                subscriber=viewer,
                author=author,
            ).exists()
        )
        return AuthorSubscriptionState(
            can_subscribe=can_subscribe,
            is_subscribed=is_subscribed,
        )

    @staticmethod
    def subscribe(subscriber: User, author: User) -> AuthorSubscriptionState:
        if subscriber == author:
            raise AuthorSubscriptionError(
                ErrorCode.REJECT,
                gettext('You cannot subscribe to yourself.'),
            )

        if not AuthorSubscriptionService.is_subscribable_author(author):
            raise AuthorSubscriptionError(
                ErrorCode.REJECT,
                gettext('This user does not publish posts.'),
            )

        try:
            with transaction.atomic():
                _, created = AuthorSubscription.objects.get_or_create(
                    subscriber=subscriber,
                    author=author,
                )
                if created:
                    AuthorSubscriptionLog.objects.create(
                        subscriber=subscriber,
                        author=author,
                        action=AuthorSubscriptionLog.Action.SUBSCRIBE,
                    )
        except IntegrityError:
            # A concurrent request created the same subscription first.
            pass

        return AuthorSubscriptionState(can_subscribe=True, is_subscribed=True)

    @staticmethod
    def unsubscribe(subscriber: User, author: User) -> AuthorSubscriptionState:
        with transaction.atomic():
            deleted_count, _ = AuthorSubscription.objects.filter(
                subscriber=subscriber,
                author=author,
            ).delete()
            if deleted_count:
                AuthorSubscriptionLog.objects.create(
                    subscriber=subscriber,
                    author=author,
                    action=AuthorSubscriptionLog.Action.UNSUBSCRIBE,
                )

        return AuthorSubscriptionState(
            can_subscribe=(
                AuthorSubscriptionService.is_subscribable_author(author)
                and subscriber != author
            ),
            is_subscribed=False,
        )

    @staticmethod
    def should_suggest_telegram_connection(user: User) -> bool:
        """Telegram is offered only when the site can deliver to it and the user has not connected yet."""
        return (
            IntegrationSettingService.is_telegram_configured()
            and not IntegrationSettingService.has_user_telegram_connection(user)
        )

    @staticmethod
    def get_settings_subscriptions(subscriber: User) -> dict[str, object]:
        return {
            'subscriptions': AuthorSubscriptionService.get_subscriptions(subscriber),
            'is_telegram_connected': (
                IntegrationSettingService.has_user_telegram_connection(subscriber)
            ),
        }

    @staticmethod
    def get_subscriptions(subscriber: User) -> list[dict[str, object]]:
        subscriptions = (
            AuthorSubscription.objects
            .filter(subscriber=subscriber)
            .select_related('author__profile')
            .order_by('-created_date')
        )

        return [
            AuthorSubscriptionService.serialize_subscription(subscription)
            for subscription in subscriptions
        ]

    @staticmethod
    def serialize_subscription(
        subscription: AuthorSubscription,
    ) -> dict[str, object]:
        author = subscription.author
        profile = getattr(author, 'profile', None)

        return {
            'username': author.username,
            'name': author.first_name,
            'avatar': profile.get_thumbnail() if profile else '',
            'bio': profile.bio if profile else '',
            'is_publishing': AuthorSubscriptionService.is_subscribable_author(author),
            'subscribed_date': (
                convert_to_localtime(subscription.created_date).date().isoformat()
            ),
        }

    @staticmethod
    def notify_subscribers(post: Post) -> int:
        """Queue new-post notifications for the author's active subscribers."""
        if not PublicPostService.is_public(post):
            return 0

        if not AuthorSubscriptionService.is_subscribable_author(post.author):
            return 0

        subscriber_ids = list(
            AuthorSubscription.objects.filter(
                author=post.author,
                subscriber__is_active=True,
            ).values_list('subscriber_id', flat=True)
        )
        if not subscriber_ids:
            return 0

        SubTaskProcessor.process(
            AuthorSubscriptionService.deliver_post_notifications,
            post.id,
            subscriber_ids,
        )
        return len(subscriber_ids)

    @staticmethod
    def deliver_post_notifications(post_id: int, subscriber_ids: list[int]) -> int:
        """
        Create one notification per subscriber. Each notification is also
        forwarded to the subscriber's Telegram when they have connected it.
        """
        post = (
            Post.objects
            .select_related('author', 'config')
            .filter(id=post_id)
            .first()
        )
        if post is None or not PublicPostService.is_public(post):
            return 0

        # Re-check at delivery time so an unsubscribe while queued is honored.
        subscribers = User.objects.filter(
            id__in=subscriber_ids,
            is_active=True,
            author_subscriptions__author=post.author,
        ).exclude(id=post.author_id)

        delivered = 0
        for subscriber in subscribers:
            try:
                _, created = NotificationCreationService.create_system(
                    user=subscriber,
                    url=post.get_absolute_url(),
                    message_key=NotificationMessageKey.POST_PUBLISHED,
                    message_params={
                        'actor': post.author.username,
                        'post_title': post.title,
                    },
                    hidden_key=f'post-published:{post.id}',
                )
            except Exception:
                logger.exception(
                    'Failed to notify subscriber about a new post',
                    extra={'post_id': post.id, 'subscriber_id': subscriber.id},
                )
                continue

            if created:
                delivered += 1

        return delivered
