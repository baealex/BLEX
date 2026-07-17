from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import User
from django.test import TestCase

from board.admin.user import ConfigAdmin, UserConfigMetaAdmin
from board.constants.config_meta import CONFIG_TYPE
from board.models import Config, UserConfigMeta


class ConfigAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='admin-config-user',
            password='test',
        )
        cls.config = Config.objects.create(user=cls.user)

    def test_configs_preview_escapes_stored_values(self):
        UserConfigMeta.objects.create(
            user=self.user,
            name=CONFIG_TYPE.NOTIFY_MENTION.value,
            value='<img src=x onerror=alert(1)>',
        )
        model_admin = ConfigAdmin(Config, AdminSite())

        rendered = str(model_admin.configs_preview(self.config))

        self.assertNotIn('<img src=x onerror=alert(1)>', rendered)
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;', rendered)


class UserConfigMetaAdminFormTestCase(TestCase):
    def test_form_rejects_non_boolean_value(self):
        form_class = UserConfigMetaAdmin.UserConfigMetaForm

        form = form_class(data={
            'name': CONFIG_TYPE.NOTIFY_MENTION.value,
            'value': '<img src=x onerror=alert(1)>',
        })

        self.assertFalse(form.is_valid())
        self.assertIn('value', form.errors)
