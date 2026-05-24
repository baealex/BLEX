from django.contrib.auth.models import User
from django.test import TestCase

from board.models import Config, Profile
from board.services.user_role_service import UserRoleService


class UserRoleServiceTestCase(TestCase):
    def test_set_superuser_status_grants_editor_role(self):
        """관리자 승격 시 첫 글을 쓸 수 있도록 편집자 권한도 부여한다."""
        user = User.objects.create_user(username='first-admin', password='password123')
        Profile.objects.create(user=user, role=Profile.Role.READER)

        UserRoleService.set_superuser_status(user, True)

        user.refresh_from_db()
        user.profile.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.profile.role, Profile.Role.EDITOR)

    def test_set_superuser_status_creates_missing_profile(self):
        """Django 기본 관리자 생성 계정도 편집자 프로필을 갖게 한다."""
        user = User.objects.create_user(username='django-admin', password='password123')

        UserRoleService.set_superuser_status(user, True)

        user.refresh_from_db()
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertEqual(user.profile.role, Profile.Role.EDITOR)

    def test_set_superuser_status_creates_missing_config(self):
        """Django 기본 관리자 생성 계정도 사용자 설정을 갖게 한다."""
        user = User.objects.create_user(username='configless-admin', password='password123')

        UserRoleService.set_superuser_status(user, True)

        self.assertTrue(Config.objects.filter(user=user).exists())

    def test_set_superuser_status_does_not_remove_editor_role_on_demote(self):
        """관리자 권한 해제는 글쓰기 권한을 임의로 빼앗지 않는다."""
        user = User.objects.create_user(
            username='editor-admin',
            password='password123',
            is_staff=True,
            is_superuser=True,
        )
        Profile.objects.create(user=user, role=Profile.Role.EDITOR)

        UserRoleService.set_superuser_status(user, False)

        user.refresh_from_db()
        user.profile.refresh_from_db()
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(user.profile.role, Profile.Role.EDITOR)
