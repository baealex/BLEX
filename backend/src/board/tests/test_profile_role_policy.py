from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.utils import timezone

from board.admin.user import ProfileAdmin
from board.models import Config, Post, PostConfig, PostContent, Profile
from board.services.auth_service import AuthService
from board.sitemaps import UserSitemap


class ProfileRolePolicyTestCase(TestCase):
    def create_author(self, username: str, role: str, is_staff: bool = False) -> User:
        user = User.objects.create_user(
            username=username,
            email=f'{username}@example.com',
            password='password123',
            is_staff=is_staff,
        )
        Profile.objects.create(user=user, role=role)
        post = Post.objects.create(
            title=f'{username} Post',
            url=f'{username}-post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=post, content_html='<p>Public</p>')
        PostConfig.objects.create(post=post, hide=False)
        return user

    def test_user_sitemap_uses_existing_editor_role_only(self):
        editor = self.create_author('editor-author', Profile.Role.EDITOR)
        self.create_author('reader-author', Profile.Role.READER)
        self.create_author('staff-reader-author', Profile.Role.READER, is_staff=True)

        items = list(UserSitemap().items())

        self.assertEqual(items, [editor.username])

    def test_profile_admin_actions_match_defined_roles(self):
        admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='password123',
        )
        admin_instance = ProfileAdmin(Profile, AdminSite())
        request = RequestFactory().get('/admin/board/profile/')
        request.user = admin_user

        actions = admin_instance.get_actions(request)

        self.assertIn('set_role_editor', actions)
        self.assertIn('set_role_reader', actions)
        self.assertNotIn('set_role_admin', actions)

    def test_login_editor_role_ignores_legacy_admin_literal(self):
        editor = User.objects.create_user(
            username='login-editor',
            email='login-editor@example.com',
            password='password123',
        )
        Profile.objects.create(user=editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=editor)

        legacy_admin = User.objects.create_user(
            username='legacy-admin',
            email='legacy-admin@example.com',
            password='password123',
        )
        Profile.objects.create(user=legacy_admin, role='ADMIN')
        Config.objects.create(user=legacy_admin)

        self.assertTrue(AuthService.get_user_login_data(editor)['has_editor_role'])
        self.assertFalse(AuthService.get_user_login_data(legacy_admin)['has_editor_role'])
