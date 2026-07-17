from django.contrib import admin
from django.contrib.auth.models import Group, Permission, User
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import translation

from board.admin.user import CustomGroupAdmin, CustomUserAdmin
from board.models import Post, Profile


class AdminPermissionBoundaryTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser(
            username='permission-root',
            email='permission-root@example.com',
            password='test',
        )
        cls.staff = User.objects.create_user(
            username='delegated-user-admin',
            email='delegated-user-admin@example.com',
            password='test',
            is_staff=True,
        )
        cls.target = User.objects.create_user(
            username='permission-target',
            email='permission-target@example.com',
            password='test',
        )
        cls.target_profile, _ = Profile.objects.get_or_create(
            user=cls.target,
            defaults={'role': Profile.Role.READER},
        )
        cls.group = Group.objects.create(name='delegated-group')
        cls.staff.user_permissions.add(
            Permission.objects.get(codename='change_user'),
            Permission.objects.get(codename='change_group'),
        )

    def setUp(self):
        self.staff = User.objects.get(pk=self.staff.pk)
        self.user_admin = CustomUserAdmin(User, admin.site)
        self.group_admin = CustomGroupAdmin(Group, admin.site)

    def admin_request(self):
        request = RequestFactory().get('/admin/')
        request.user = self.staff
        return request

    def superuser_request(self):
        request = RequestFactory().get('/admin/')
        request.user = self.superuser
        return request

    def permission_fields(self):
        request = self.superuser_request()
        group_form = self.group_admin.get_form(
            request,
            self.group,
        )(instance=self.group)
        user_form = self.user_admin.get_form(
            request,
            self.target,
        )(instance=self.target)
        return (
            group_form.fields['permissions'],
            user_form.fields['user_permissions'],
        )

    def test_delegated_staff_cannot_change_superuser_or_password(self):
        request = self.admin_request()

        self.assertFalse(
            self.user_admin.has_change_permission(request, self.superuser),
        )

        self.client.force_login(self.staff)
        change_response = self.client.post(
            reverse('admin:auth_user_change', args=[self.superuser.pk]),
            {'username': self.superuser.username},
        )
        password_response = self.client.get(
            reverse(
                'admin:auth_user_password_change',
                args=[self.superuser.pk],
            ),
        )

        self.assertEqual(change_response.status_code, 403)
        self.assertEqual(password_response.status_code, 403)

    def test_crafted_user_post_cannot_grant_privileged_fields(self):
        request = self.admin_request()
        readonly_fields = set(
            self.user_admin.get_readonly_fields(request, self.target),
        )

        self.assertTrue(
            set(self.user_admin.delegated_readonly_fields).issubset(
                readonly_fields,
            ),
        )

        self.client.force_login(self.staff)
        response = self.client.post(
            reverse('admin:auth_user_change', args=[self.target.pk]),
            {
                'username': self.target.username,
                'first_name': '',
                'last_name': '',
                'email': self.target.email,
                'is_active': 'on',
                'date_joined_0': self.target.date_joined.strftime('%Y-%m-%d'),
                'date_joined_1': self.target.date_joined.strftime('%H:%M:%S'),
                'is_staff': 'on',
                'is_superuser': 'on',
                'groups': [str(self.group.pk)],
                'user_permissions': [
                    str(Permission.objects.get(codename='change_user').pk),
                ],
                '_save': 'Save',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.target.refresh_from_db()
        self.assertFalse(self.target.is_staff)
        self.assertFalse(self.target.is_superuser)
        self.assertFalse(self.target.groups.exists())
        self.assertFalse(self.target.user_permissions.exists())

    def test_user_role_actions_require_profile_change_permission(self):
        request = self.admin_request()

        self.assertNotIn('make_editor', self.user_admin.get_actions(request))
        self.assertNotIn('make_reader', self.user_admin.get_actions(request))

        self.staff.user_permissions.add(
            Permission.objects.get(codename='change_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)

        actions = self.user_admin.get_actions(self.admin_request())
        self.assertIn('make_editor', actions)
        self.assertIn('make_reader', actions)

    def test_group_permission_bundles_are_superuser_only(self):
        request = self.admin_request()

        self.assertFalse(self.group_admin.has_add_permission(request))
        self.assertFalse(
            self.group_admin.has_change_permission(request, self.group),
        )
        self.assertFalse(
            self.group_admin.has_delete_permission(request, self.group),
        )

        self.client.force_login(self.staff)
        response = self.client.post(
            reverse('admin:auth_group_change', args=[self.group.pk]),
            {
                'name': 'privileged-group',
                'permissions': [
                    str(Permission.objects.get(codename='change_user').pk),
                ],
                '_save': 'Save',
            },
        )

        self.assertEqual(response.status_code, 403)
        self.group.refresh_from_db()
        self.assertEqual(self.group.name, 'delegated-group')
        self.assertFalse(self.group.permissions.exists())

    def test_superuser_keeps_existing_privilege_management(self):
        request = RequestFactory().get('/admin/')
        request.user = self.superuser

        self.assertTrue(self.group_admin.has_add_permission(request))
        self.assertTrue(
            self.group_admin.has_change_permission(request, self.group),
        )
        self.assertTrue(
            self.group_admin.has_delete_permission(request, self.group),
        )
        readonly_fields = set(
            self.user_admin.get_readonly_fields(request, self.target),
        )
        self.assertTrue(
            set(self.user_admin.delegated_readonly_fields).isdisjoint(
                readonly_fields,
            ),
        )

    def test_standard_permission_labels_follow_active_language(self):
        content_type = ContentType.objects.get_for_model(Post)
        permissions = [
            Permission.objects.get(
                content_type=content_type,
                codename=f'{action}_post',
            )
            for action in ('add', 'change', 'delete', 'view')
        ]
        stored_values = {
            permission.pk: (permission.name, permission.codename)
            for permission in permissions
        }

        expected_labels = {
            'en': ['Add Post', 'Change Post', 'Delete Post', 'View Post'],
            'ko': ['포스트 추가', '포스트 수정', '포스트 삭제', '포스트 보기'],
        }
        for language, expected in expected_labels.items():
            with self.subTest(language=language), translation.override(language):
                for field in self.permission_fields():
                    with CaptureQueriesContext(connection) as queries:
                        selected_permissions = list(
                            field.queryset.filter(
                                pk__in=[permission.pk for permission in permissions],
                            ).order_by('codename'),
                        )
                        labels = [
                            field.label_from_instance(permission)
                            for permission in selected_permissions
                        ]

                    self.assertEqual(len(queries), 1)
                    self.assertEqual(labels, expected)

        for permission in permissions:
            permission.refresh_from_db()
            self.assertEqual(
                (permission.name, permission.codename),
                stored_values[permission.pk],
            )

    def test_custom_or_orphaned_permissions_keep_their_stored_label(self):
        content_type = ContentType.objects.create(
            app_label='legacy',
            model='retiredentry',
        )
        permission = Permission.objects.create(
            content_type=content_type,
            codename='archive_retiredentry',
            name='Archive retired entry',
        )

        with translation.override('ko'):
            for field in self.permission_fields():
                self.assertEqual(
                    field.label_from_instance(permission),
                    str(permission),
                )
