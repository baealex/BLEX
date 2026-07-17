from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db.models import Model


class AdminSettingsAuditService:
    """Write redacted audit records for product settings mutations."""

    @staticmethod
    def record_change(*, user: User, target: Model, change_message: str) -> None:
        LogEntry.objects.create(
            user_id=user.pk,
            content_type=ContentType.objects.get_for_model(target),
            object_id=str(target.pk) if target.pk else None,
            object_repr=str(target),
            action_flag=CHANGE,
            change_message=change_message,
        )
