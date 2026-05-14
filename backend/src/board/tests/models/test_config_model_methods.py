from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase

from board.constants.config_meta import CONFIG_TYPE
from board.models import Config, User, UserConfigMeta


class ConfigModelMethodsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='config-user',
            password='test',
            email='config-user@test.com',
        )
        self.config = Config.objects.create(user=self.user)

    def test_create_or_update_meta_rejects_unknown_config(self):
        invalid_config = SimpleNamespace(value='UNKNOWN_CONFIG')

        result = self.config.create_or_update_meta(invalid_config, 'true')

        self.assertIsNone(result)
        self.assertFalse(UserConfigMeta.objects.filter(user=self.user).exists())

    def test_get_meta_rejects_unknown_config(self):
        invalid_config = SimpleNamespace(value='UNKNOWN_CONFIG')

        result = self.config.get_meta(invalid_config)

        self.assertIsNone(result)

    def test_create_or_update_meta_creates_string_value(self):
        result = self.config.create_or_update_meta(
            CONFIG_TYPE.NOTIFY_MENTION,
            'true',
        )

        self.assertTrue(result)
        meta = UserConfigMeta.objects.get(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
        )
        self.assertEqual(meta.value, 'true')
        self.assertEqual(self.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), True)

    def test_create_or_update_meta_stringifies_new_non_string_value(self):
        result = self.config.create_or_update_meta(
            CONFIG_TYPE.NOTIFY_MENTION,
            True,
        )

        self.assertTrue(result)
        meta = UserConfigMeta.objects.get(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
        )
        self.assertEqual(meta.value, 'True')
        self.assertEqual(self.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), False)


    def test_create_or_update_meta_keeps_existing_non_string_update_behavior(self):
        UserConfigMeta.objects.create(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
            value='false',
        )

        result = self.config.create_or_update_meta(
            CONFIG_TYPE.NOTIFY_MENTION,
            True,
        )

        self.assertTrue(result)
        meta = UserConfigMeta.objects.get(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
        )
        self.assertEqual(meta.value, 'True')
        self.assertEqual(self.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), False)

    def test_create_or_update_meta_does_not_save_unchanged_existing_value(self):
        UserConfigMeta.objects.create(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
            value='true',
        )

        with patch.object(UserConfigMeta, 'save', autospec=True) as save_mock:
            result = self.config.create_or_update_meta(
                CONFIG_TYPE.NOTIFY_MENTION,
                'true',
            )

        self.assertTrue(result)
        save_mock.assert_not_called()
        meta = UserConfigMeta.objects.get(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
        )
        self.assertEqual(meta.value, 'true')

    def test_create_or_update_meta_updates_changed_existing_value(self):
        UserConfigMeta.objects.create(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
            value='false',
        )
        original_save = UserConfigMeta.save

        def save_spy(instance, *args, **kwargs):
            return original_save(instance, *args, **kwargs)

        with patch.object(
            UserConfigMeta,
            'save',
            autospec=True,
            side_effect=save_spy,
        ) as save_mock:
            result = self.config.create_or_update_meta(
                CONFIG_TYPE.NOTIFY_MENTION,
                'true',
            )

        self.assertTrue(result)
        save_mock.assert_called_once()
        meta = UserConfigMeta.objects.get(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
        )
        self.assertEqual(meta.value, 'true')
        self.assertEqual(self.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), True)

    def test_get_meta_returns_none_when_value_is_missing(self):
        result = self.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION)

        self.assertIsNone(result)
