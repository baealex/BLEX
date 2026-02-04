"""
Webhook Service

Handles sending webhook notifications to author's channels when new posts are published.
Supports Discord, Slack, and other webhook-compatible services.
"""
import logging
import requests

from django.conf import settings

from board.models import Post, PostConfig, WebhookSubscription, Profile
from modules.sub_task import SubTaskProcessor


logger = logging.getLogger(__name__)


class WebhookService:
    """Service for managing webhook notification channels."""

    WEBHOOK_TIMEOUT = 10  # seconds

    @staticmethod
    def send_webhook(url: str, content: str, post_url: str) -> bool:
        """
        Send a webhook notification to a URL.
        Supports Discord and Slack webhook formats.

        Args:
            url: Webhook URL
            content: Message content
            post_url: URL to the published post

        Returns:
            True if successful, False otherwise
        """
        try:
            # Detect webhook type and format payload accordingly
            if 'discord' in url.lower():
                payload = {'content': content}
            elif 'slack' in url.lower():
                payload = {
                    'text': content,
                    'unfurl_links': True
                }
            else:
                # Generic webhook format
                payload = {
                    'content': content,
                    'text': content,
                    'message': content,
                    'url': post_url
                }

            response = requests.post(
                url,
                json=payload,
                timeout=WebhookService.WEBHOOK_TIMEOUT
            )
            response.raise_for_status()
            return True
        except requests.RequestException as e:
            logger.warning(f'Failed to send webhook to {url}: {e}')
            return False

    @staticmethod
    def send_webhook_with_tracking(
        channel: WebhookSubscription,
        content: str,
        post_url: str
    ) -> bool:
        """
        Send webhook and track success/failure.
        Auto-deactivates channel after 3 consecutive failures.

        Args:
            channel: WebhookSubscription instance
            content: Message content
            post_url: URL to the post

        Returns:
            True if successful, False otherwise
        """
        success = WebhookService.send_webhook(
            url=channel.webhook_url,
            content=content,
            post_url=post_url
        )

        if success:
            channel.record_success()
        else:
            channel.record_failure()
            if not channel.is_active:
                logger.info(
                    f'Webhook channel {channel.id} deactivated '
                    f'after {channel.MAX_FAILURES} consecutive failures'
                )

        return success

    @staticmethod
    def notify_channels(post: Post, post_config: PostConfig) -> int:
        """
        Send webhook notifications to all active channels of the post author.
        Only sends if the post is published and not hidden.
        Tracks success/failure for each channel.

        Args:
            post: The published Post instance
            post_config: PostConfig instance with visibility settings

        Returns:
            Number of channels notified (0 if skipped)
        """
        if post_config.hide or not post.is_published():
            return 0

        author_profile = Profile.objects.filter(user=post.author).first()
        if not author_profile:
            return 0

        # Get channel IDs to avoid issues with lazy evaluation
        channel_ids = list(
            WebhookSubscription.objects.filter(
                author=author_profile,
                is_active=True
            ).values_list('id', flat=True)
        )

        if not channel_ids:
            return 0

        post_url = settings.SITE_URL + post.get_absolute_url()
        author_name = post.author.first_name or post.author.username
        content = f'[{author_name}] 새 글이 발행되었어요: [{post.title}]({post_url})'

        def send_all_webhooks():
            # Re-fetch channels in the async context
            channels = WebhookSubscription.objects.filter(
                id__in=channel_ids,
                is_active=True
            )
            for channel in channels:
                WebhookService.send_webhook_with_tracking(
                    channel=channel,
                    content=content,
                    post_url=post_url
                )

        SubTaskProcessor.process(send_all_webhooks)
        return len(channel_ids)

    @staticmethod
    def create_subscription(
        author: Profile,
        webhook_url: str,
        name: str = ''
    ) -> WebhookSubscription:
        """
        Create or reactivate a webhook channel.

        Args:
            author: Profile of the author
            webhook_url: Webhook URL for notifications
            name: Optional name/description for the channel

        Returns:
            Created/reactivated WebhookSubscription instance
        """
        channel, created = WebhookSubscription.objects.get_or_create(
            author=author,
            webhook_url=webhook_url,
            defaults={'name': name}
        )
        if not created:
            # Reactivate and reset failure count if re-adding
            channel.is_active = True
            channel.failure_count = 0
            if name:
                channel.name = name
            channel.save(update_fields=['is_active', 'failure_count', 'name'])
        return channel

    @staticmethod
    def test_webhook(webhook_url: str) -> bool:
        """
        Send a test message to verify webhook URL is working.

        Args:
            webhook_url: Webhook URL to test

        Returns:
            True if successful, False otherwise
        """
        test_content = 'BLEX 웹훅 연결 테스트입니다.'
        return WebhookService.send_webhook(
            url=webhook_url,
            content=test_content,
            post_url=settings.SITE_URL
        )
