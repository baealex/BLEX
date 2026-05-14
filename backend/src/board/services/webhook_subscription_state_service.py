from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils import timezone

if TYPE_CHECKING:
    from board.models import WebhookSubscription


class WebhookSubscriptionStateService:
    """Manage webhook subscription delivery state transitions."""

    @staticmethod
    def record_success(channel: 'WebhookSubscription') -> None:
        channel.failure_count = 0
        channel.last_success_date = timezone.now()
        channel.save(update_fields=['failure_count', 'last_success_date'])

    @staticmethod
    def record_failure(channel: 'WebhookSubscription') -> None:
        channel.failure_count += 1
        if channel.failure_count >= channel.MAX_FAILURES:
            channel.is_active = False
        channel.save(update_fields=['failure_count', 'is_active'])
