from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType


class UtilityCleanupAuditService:
    """Write redacted audit records for destructive utility executions."""

    OBJECT_REPR = 'System utilities'
    ACTION_INTENT_MESSAGES = {
        'clean_images': 'Started unused image cleanup',
    }
    ACTION_MESSAGES = {
        'clean_tags': 'Executed unused tag cleanup',
        'clean_sessions': 'Executed session cleanup',
        'clean_logs': 'Executed expired log cleanup',
        'clean_images': 'Executed unused image cleanup',
    }

    @classmethod
    def record_execution(cls, *, user: User, action: str) -> LogEntry:
        return cls._record(
            user=user,
            change_message=cls.ACTION_MESSAGES[action],
        )

    @classmethod
    def record_intent(cls, *, user: User, action: str) -> LogEntry:
        return cls._record(
            user=user,
            change_message=cls.ACTION_INTENT_MESSAGES[action],
        )

    @staticmethod
    def mark_completed(*, audit_entry: LogEntry, action: str) -> None:
        audit_entry.change_message = UtilityCleanupAuditService.ACTION_MESSAGES[action]
        audit_entry.save(update_fields=['change_message'])

    @staticmethod
    def _record(*, user: User, change_message: str) -> LogEntry:
        return LogEntry.objects.create(
            user_id=user.pk,
            content_type=ContentType.objects.get_for_model(LogEntry),
            object_id=None,
            object_repr=UtilityCleanupAuditService.OBJECT_REPR,
            action_flag=CHANGE,
            change_message=change_message,
        )
