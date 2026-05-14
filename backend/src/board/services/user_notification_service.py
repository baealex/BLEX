import datetime

from django.contrib.auth.models import User
from django.db.models import Q, QuerySet
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import Notify


class UserNotificationService:
    """Read and update private notification settings for the settings API."""

    RECENT_NOTIFY_DAYS = 180

    @staticmethod
    def get_notify_configs_by_role(user: User) -> list[CONFIG_TYPE]:
        configs = [
            CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
            CONFIG_TYPE.NOTIFY_MENTION,
        ]

        if hasattr(user, 'profile') and user.profile.is_editor():
            configs = [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
            ] + configs

        return configs

    @staticmethod
    def get_recent_notifications(user: User) -> QuerySet[Notify]:
        recent_threshold = timezone.now() - datetime.timedelta(
            days=UserNotificationService.RECENT_NOTIFY_DAYS,
        )
        return Notify.objects.filter(user=user).filter(
            Q(created_date__gt=recent_threshold) |
            Q(has_read=False)
        ).order_by('-created_date')

    @staticmethod
    def serialize_notification(item: Notify) -> dict:
        return {
            'id': item.id,
            'url': item.url,
            'is_read': item.has_read,
            'content': item.content,
            'created_date': item.time_since(),
        }

    @staticmethod
    def get_settings_notify(user: User) -> dict:
        return {
            'notify': [
                UserNotificationService.serialize_notification(item)
                for item in UserNotificationService.get_recent_notifications(user)
            ],
            'is_telegram_sync': user.config.has_telegram_id(),
        }

    @staticmethod
    def get_settings_notify_config(user: User) -> dict:
        return {
            'config': [
                {
                    'name': config.value,
                    'value': user.config.get_meta(config),
                }
                for config in UserNotificationService.get_notify_configs_by_role(user)
            ]
        }

    @staticmethod
    def mark_notification_as_read(user: User, notification_id: str) -> bool:
        notify = Notify.objects.filter(id=notification_id, user=user)
        if not notify.exists():
            return False

        notification = notify.first()
        notification.has_read = True
        notification.save()
        return True

    @staticmethod
    def update_settings_notify_config(user: User, put) -> None:
        for config in UserNotificationService.get_notify_configs_by_role(user):
            value = put.get(config.value)
            if value in (None, ''):
                continue
            if isinstance(value, bool):
                value = 'true' if value else 'false'
            user.config.create_or_update_meta(config, value)
