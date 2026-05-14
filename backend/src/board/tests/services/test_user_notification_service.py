from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import Config, Notify, Profile, User
from board.services.user_notification_service import UserNotificationService


class UserNotificationServiceTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='notify-user', password='test')
        Config.objects.create(user=self.user)
        Profile.objects.create(user=self.user, role=Profile.Role.EDITOR)

    def create_notify(self, key, has_read=False, created_date=None):
        return Notify.objects.create(
            user=self.user,
            content=key,
            url=f'/{key}',
            key=key,
            has_read=has_read,
            created_date=created_date or timezone.now(),
        )

    def test_get_notify_configs_by_role_keeps_editor_and_reader_visibility(self):
        reader = User.objects.create_user(username='notify-reader', password='test')
        Config.objects.create(user=reader)
        Profile.objects.create(user=reader, role=Profile.Role.READER)

        editor_configs = UserNotificationService.get_notify_configs_by_role(self.user)
        reader_configs = UserNotificationService.get_notify_configs_by_role(reader)

        self.assertEqual(
            editor_configs,
            [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_MENTION,
            ],
        )
        self.assertEqual(
            reader_configs,
            [
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_MENTION,
            ],
        )

    def test_get_recent_notifications_keeps_recent_or_unread_policy(self):
        recent_read = self.create_notify('recent-read', has_read=True)
        old_unread = self.create_notify(
            'old-unread',
            has_read=False,
            created_date=timezone.now() - timedelta(days=181),
        )
        self.create_notify(
            'old-read',
            has_read=True,
            created_date=timezone.now() - timedelta(days=181),
        )

        notifications = list(UserNotificationService.get_recent_notifications(self.user))

        self.assertEqual(
            {item.id for item in notifications},
            {recent_read.id, old_unread.id},
        )

    def test_get_settings_notify_config_serializes_current_values(self):
        self.user.config.create_or_update_meta(
            CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
            'true',
        )

        payload = UserNotificationService.get_settings_notify_config(self.user)

        config_map = {
            item['name']: item['value']
            for item in payload['config']
        }
        self.assertEqual(config_map[CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value], True)

    def test_update_settings_notify_config_skips_empty_and_converts_bool(self):
        put = type('QueryDict', (), {
            'get': lambda self, key, default='': {
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: True,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: '',
            }.get(key, default)
        })()

        UserNotificationService.update_settings_notify_config(self.user, put)

        self.assertEqual(self.user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE), True)
        self.assertIsNone(self.user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT))

    def test_mark_notification_as_read_returns_false_when_missing(self):
        self.assertFalse(
            UserNotificationService.mark_notification_as_read(self.user, '999999')
        )

    def test_mark_notification_as_read_updates_existing_notification(self):
        notification = self.create_notify('mark-read', has_read=False)

        result = UserNotificationService.mark_notification_as_read(
            self.user,
            str(notification.id),
        )

        notification.refresh_from_db()
        self.assertTrue(result)
        self.assertTrue(notification.has_read)

    def test_mark_notification_as_read_returns_false_for_other_user_notification(self):
        other_user = User.objects.create_user(username='notify-other', password='test')
        Config.objects.create(user=other_user)
        notification = self.create_notify('other-user-notify', has_read=False)

        result = UserNotificationService.mark_notification_as_read(
            other_user,
            str(notification.id),
        )

        notification.refresh_from_db()
        self.assertFalse(result)
        self.assertFalse(notification.has_read)
