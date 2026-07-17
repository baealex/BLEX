from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Sequence

from django.contrib.admin.models import LogEntry
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
    def enqueue(
        user_ids: Sequence[int],
        url: str,
        content: str,
        *,
        audit_log_id: int | None = None,
    ) -> str | None:
        """Return a task identifier only when the background queue accepted it."""
        return SubTaskProcessor.submit(
            BulkNotificationDeliveryService.deliver,
            list(user_ids),
            url,
            content,
            audit_log_id=audit_log_id,
        )

    @staticmethod
    def deliver(
        user_ids: Sequence[int],
        url: str,
        content: str,
        *,
        audit_log_id: int | None = None,
    ) -> BulkNotificationDeliveryStats:
        try:
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
        except Exception as error:
            BulkNotificationDeliveryService._record_audit_failure(
                audit_log_id,
                requested_count=len(user_ids),
            )
            logger.error(
                'Bulk notification processing aborted exception_type=%s',
                type(error).__name__,
            )
            raise

        BulkNotificationDeliveryService._record_audit_outcome(
            audit_log_id,
            stats,
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

    @staticmethod
    def _record_audit_outcome(
        audit_log_id: int | None,
        stats: BulkNotificationDeliveryStats,
    ) -> None:
        if audit_log_id is None:
            return

        message = (
            'Admin 전체 알림 발송 처리 완료: '
            f'대상 {stats.requested_count}명, '
            f'생성 {stats.success_count}명, '
            f'중복 {stats.duplicate_count}명, '
            f'실패 {stats.failure_count}명'
        )
        BulkNotificationDeliveryService._update_audit_message(
            audit_log_id,
            message,
        )

    @staticmethod
    def _record_audit_failure(
        audit_log_id: int | None,
        *,
        requested_count: int,
    ) -> None:
        if audit_log_id is None:
            return

        BulkNotificationDeliveryService._update_audit_message(
            audit_log_id,
            f'Admin 전체 알림 발송 처리 실패: 대상 {requested_count}명',
        )

    @staticmethod
    def _update_audit_message(audit_log_id: int, message: str) -> None:
        try:
            updated_count = LogEntry.objects.filter(pk=audit_log_id).update(
                change_message=message,
            )
        except Exception as error:
            logger.error(
                'Bulk notification audit update failed audit_log_id=%s '
                'exception_type=%s',
                audit_log_id,
                type(error).__name__,
            )
            return

        if not updated_count:
            logger.error(
                'Bulk notification audit record missing audit_log_id=%s',
                audit_log_id,
            )
