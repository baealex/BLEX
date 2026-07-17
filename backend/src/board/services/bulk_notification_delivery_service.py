from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from django.contrib.auth.models import User

from modules.sub_task import SubTaskProcessor

from board.services.notification_creation_service import (
    NotificationCreationService,
)

logger = logging.getLogger('board.notification')


@dataclass(frozen=True)
class BulkNotificationDeliveryStats:
    requested_count: int
    success_count: int
    duplicate_count: int
    failure_count: int


class BulkNotificationDeliveryService:
    """Process an Admin bulk-notification request outside its HTTP request."""

    @staticmethod
    def enqueue(user_ids: Sequence[int], url: str, content: str) -> None:
        SubTaskProcessor.process(
            BulkNotificationDeliveryService.deliver,
            list(user_ids),
            url,
            content,
        )

    @staticmethod
    def deliver(
        user_ids: Sequence[int],
        url: str,
        content: str,
    ) -> BulkNotificationDeliveryStats:
        users_by_id = User.objects.in_bulk(user_ids)
        success_count = 0
        duplicate_count = 0
        failure_count = 0

        for user_id in user_ids:
            user = users_by_id.get(user_id)
            if user is None:
                failure_count += 1
                continue

            try:
                _, created = NotificationCreationService.create(
                    user=user,
                    url=url,
                    content=content,
                )
            except Exception as error:
                failure_count += 1
                logger.error(
                    'Bulk notification processing failed exception_type=%s',
                    type(error).__name__,
                )
                continue

            if created:
                success_count += 1
            else:
                duplicate_count += 1

        stats = BulkNotificationDeliveryStats(
            requested_count=len(user_ids),
            success_count=success_count,
            duplicate_count=duplicate_count,
            failure_count=failure_count,
        )
        logger.info(
            'Bulk notification processing completed requested=%s '
            'succeeded=%s duplicated=%s failed=%s',
            stats.requested_count,
            stats.success_count,
            stats.duplicate_count,
            stats.failure_count,
        )
        return stats
