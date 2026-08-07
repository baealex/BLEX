from __future__ import annotations

from django.contrib.auth.models import User
from django.db import transaction

from board.models import Notify
from board.services.notification_message_service import (
    NotificationMessageKey,
    NotificationMessageService,
)
from board.services.notification_url_service import NotificationUrlService


class NotificationCreationService:
    """Create a notification once before requesting external delivery."""

    @staticmethod
    def create(
        user: User,
        url: str,
        content: str,
        hidden_key: str | None = None,
    ) -> tuple[Notify, bool]:
        return NotificationCreationService._create(
            user=user,
            url=url,
            content=content,
            identity=content,
            hidden_key=hidden_key,
        )

    @staticmethod
    def create_system(
        user: User,
        url: str,
        message_key: NotificationMessageKey | str,
        message_params: dict[str, object],
        hidden_key: str | None = None,
    ) -> tuple[Notify, bool]:
        normalized_key = NotificationMessageKey(message_key).value
        normalized_params = NotificationMessageService.normalize_params(
            message_params,
        )
        content = NotificationMessageService.render(
            normalized_key,
            normalized_params,
        )
        if not content:
            raise ValueError('Invalid structured notification message.')

        return NotificationCreationService._create(
            user=user,
            url=url,
            content=content,
            identity=NotificationMessageService.identity(
                normalized_key,
                normalized_params,
            ),
            message_key=normalized_key,
            message_params=normalized_params,
            hidden_key=hidden_key,
        )

    @staticmethod
    def _create(
        user: User,
        url: str,
        content: str,
        identity: str,
        *,
        message_key: str = '',
        message_params: dict[str, object] | None = None,
        hidden_key: str | None = None,
    ) -> tuple[Notify, bool]:
        url = NotificationUrlService.validate(url)
        key = Notify.create_hash_key(
            user=user,
            url=url,
            content=identity,
            hidden_key=hidden_key,
        )
        with transaction.atomic():
            notify, created = Notify.objects.get_or_create(
                key=key,
                defaults={
                    'user': user,
                    'url': url,
                    'content': content,
                    'message_key': message_key,
                    'message_params': message_params or {},
                },
            )

        if created:
            notify.send_notify()

        return notify, created
