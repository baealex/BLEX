import json

from django.contrib.auth.models import AnonymousUser, User
from django.test import TestCase

from board.models import Profile
from board.services.api_permission_service import ApiPermissionService


class ApiPermissionServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user(
            username='permission-editor',
            password='test',
            email='editor@example.com',
        )
        Profile.objects.create(user=cls.editor, role=Profile.Role.EDITOR)

        cls.normal_user = User.objects.create_user(
            username='permission-normal',
            password='test',
            email='normal@example.com',
        )
        Profile.objects.create(user=cls.normal_user)

        cls.inactive_user = User.objects.create_user(
            username='permission-inactive',
            password='test',
            email='inactive@example.com',
            is_active=False,
        )
        Profile.objects.create(user=cls.inactive_user, role=Profile.Role.EDITOR)

    def assert_error_code(self, response, error_code):
        self.assertIsNotNone(response)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], error_code)

    def test_require_login_rejects_anonymous_and_inactive_users(self):
        self.assert_error_code(ApiPermissionService.require_login(AnonymousUser()), 'error:NL')
        self.assert_error_code(ApiPermissionService.require_login(self.inactive_user), 'error:NL')

    def test_require_login_allows_active_user(self):
        self.assertIsNone(ApiPermissionService.require_login(self.normal_user))

    def test_require_editor_rejects_anonymous_inactive_and_normal_users(self):
        self.assert_error_code(ApiPermissionService.require_editor(AnonymousUser()), 'error:NL')
        self.assert_error_code(ApiPermissionService.require_editor(self.inactive_user), 'error:NL')
        self.assert_error_code(ApiPermissionService.require_editor(self.normal_user), 'error:RJ')

    def test_require_editor_allows_editor(self):
        self.assertIsNone(ApiPermissionService.require_editor(self.editor))
