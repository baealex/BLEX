from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.auth.models import Group, Permission, User
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import translation

from board.admin.user import CustomGroupAdmin, CustomUserAdmin, ProfileAdmin
from board.models import (
    IntegrationSetting,
    LoginSetting,
    Post,
    Profile,
    SiteSetting,
    StaticPage,
)
from board.services.user_management_service import UserManagementService


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
        cls.staff_profile = Profile.objects.create(
            user=cls.staff,
            role=Profile.Role.READER,
        )
        cls.target = User.objects.create_user(
            username='permission-target',
            email='permission-target@example.com',
            password='test',
        )
        cls.privileged_staff = User.objects.create_user(
            username='privileged-staff',
            email='privileged-staff@example.com',
            password='original-password',
            is_staff=True,
        )
        cls.privileged_staff_profile = Profile.objects.create(
            user=cls.privileged_staff,
            role=Profile.Role.READER,
        )
        cls.privileged_user_without_profile = User.objects.create_user(
            username='privileged-without-profile',
            email='privileged-without-profile@example.com',
            password='test',
            is_staff=True,
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
        self.profile_admin = ProfileAdmin(Profile, admin.site)

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

    def test_delegated_staff_cannot_change_privileged_staff_or_password(self):
        request = self.admin_request()

        self.assertTrue(
            self.user_admin.has_change_permission(request, self.staff),
        )
        self.assertFalse(
            self.user_admin.has_change_permission(
                request,
                self.privileged_staff,
            ),
        )

        self.client.force_login(self.staff)
        change_response = self.client.post(
            reverse(
                'admin:auth_user_change',
                args=[self.privileged_staff.pk],
            ),
            {'username': self.privileged_staff.username},
        )
        password_response = self.client.post(
            reverse(
                'admin:auth_user_password_change',
                args=[self.privileged_staff.pk],
            ),
            {
                'password1': 'replacement-password',
                'password2': 'replacement-password',
            },
        )

        self.assertEqual(change_response.status_code, 403)
        self.assertEqual(password_response.status_code, 403)
        self.privileged_staff.refresh_from_db()
        self.assertTrue(self.privileged_staff.check_password('original-password'))

    def test_delegated_staff_cannot_change_privileged_staff_active_state(self):
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse('admin:auth_user_changelist'),
            {
                helpers.ACTION_CHECKBOX_NAME: [str(self.privileged_staff.pk)],
                'action': 'deactivate_users',
                'select_across': '0',
                'confirm': 'yes',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.privileged_staff.refresh_from_db()
        self.assertTrue(self.privileged_staff.is_active)

    def test_user_active_status_service_protects_staff_for_delegated_actor(self):
        result = UserManagementService.set_active_status(
            self.staff,
            [self.privileged_staff.pk],
            is_active=False,
        )

        self.assertEqual(result.changed_users, ())
        self.assertEqual(result.skipped_protected_admin_count, 1)
        self.privileged_staff.refresh_from_db()
        self.assertTrue(self.privileged_staff.is_active)

    def test_superuser_keeps_staff_account_active_state_management(self):
        result = UserManagementService.set_active_status(
            self.superuser,
            [self.privileged_staff.pk],
            is_active=False,
        )

        self.assertEqual(result.changed_users, (self.privileged_staff,))
        self.assertEqual(result.skipped_protected_admin_count, 0)
        self.privileged_staff.refresh_from_db()
        self.assertFalse(self.privileged_staff.is_active)

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

    def test_delegated_staff_cannot_change_or_delete_privileged_profiles(self):
        self.staff.user_permissions.add(
            Permission.objects.get(codename='change_profile'),
            Permission.objects.get(codename='delete_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        request = self.admin_request()

        self.assertFalse(
            self.profile_admin.has_change_permission(
                request,
                self.privileged_staff_profile,
            ),
        )
        self.assertFalse(
            self.profile_admin.has_delete_permission(
                request,
                self.privileged_staff_profile,
            ),
        )

        self.client.force_login(self.staff)
        change_response = self.client.post(
            reverse(
                'admin:board_profile_change',
                args=[self.privileged_staff_profile.pk],
            ),
            {'role': Profile.Role.EDITOR},
        )
        delete_response = self.client.post(
            reverse(
                'admin:board_profile_delete',
                args=[self.privileged_staff_profile.pk],
            ),
        )

        self.assertEqual(change_response.status_code, 403)
        self.assertEqual(delete_response.status_code, 403)
        self.privileged_staff_profile.refresh_from_db()
        self.assertEqual(self.privileged_staff_profile.role, Profile.Role.READER)

    def test_delegated_bulk_delete_keeps_mixed_privileged_profiles(self):
        self.staff.user_permissions.add(
            Permission.objects.get(codename='delete_profile'),
            Permission.objects.get(codename='view_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        self.client.force_login(self.staff)
        selection = {
            helpers.ACTION_CHECKBOX_NAME: [
                str(self.target_profile.pk),
                str(self.privileged_staff_profile.pk),
            ],
            'action': 'delete_selected',
            'select_across': '0',
        }

        confirmation_response = self.client.post(
            reverse('admin:board_profile_changelist'),
            selection,
        )
        confirmed_response = self.client.post(
            reverse('admin:board_profile_changelist'),
            {**selection, 'post': 'yes'},
        )

        self.assertEqual(confirmation_response.status_code, 200)
        self.assertEqual(confirmed_response.status_code, 403)
        self.assertTrue(
            Profile.objects.filter(pk=self.target_profile.pk).exists(),
        )
        self.assertTrue(
            Profile.objects.filter(
                pk=self.privileged_staff_profile.pk,
            ).exists(),
        )

    def test_delegated_profile_role_action_skips_privileged_profiles(self):
        self.staff.user_permissions.add(
            Permission.objects.get(codename='change_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse('admin:board_profile_changelist'),
            {
                helpers.ACTION_CHECKBOX_NAME: [
                    str(self.target_profile.pk),
                    str(self.privileged_staff_profile.pk),
                ],
                'action': 'set_role_editor',
                'select_across': '0',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.target_profile.refresh_from_db()
        self.privileged_staff_profile.refresh_from_db()
        self.assertEqual(self.target_profile.role, Profile.Role.EDITOR)
        self.assertEqual(
            self.privileged_staff_profile.role,
            Profile.Role.READER,
        )

    def test_delegated_staff_cannot_create_profile_for_privileged_user(self):
        self.staff.user_permissions.add(
            Permission.objects.get(codename='add_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse('admin:board_profile_add'),
            {
                'user': str(self.privileged_user_without_profile.pk),
                'role': Profile.Role.EDITOR,
                '_save': 'Save',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            Profile.objects.filter(
                user=self.privileged_user_without_profile,
            ).exists(),
        )

    def test_delegated_staff_cannot_change_own_profile_role_through_user_inline(self):
        self.staff.user_permissions.add(
            Permission.objects.get(codename='change_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse('admin:auth_user_change', args=[self.staff.pk]),
            {
                'username': self.staff.username,
                'first_name': '',
                'last_name': '',
                'email': self.staff.email,
                'is_active': 'on',
                'date_joined_0': self.staff.date_joined.strftime('%Y-%m-%d'),
                'date_joined_1': self.staff.date_joined.strftime('%H:%M:%S'),
                'profile-TOTAL_FORMS': '1',
                'profile-INITIAL_FORMS': '1',
                'profile-MIN_NUM_FORMS': '0',
                'profile-MAX_NUM_FORMS': '1',
                'profile-0-id': str(self.staff_profile.pk),
                'profile-0-role': Profile.Role.EDITOR,
                '_save': 'Save',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.staff_profile.refresh_from_db()
        self.assertEqual(self.staff_profile.role, Profile.Role.READER)

    def test_delegated_staff_cannot_add_own_profile_through_user_inline(self):
        self.staff_profile.delete()
        self.staff.user_permissions.add(
            Permission.objects.get(codename='add_profile'),
        )
        self.staff = User.objects.get(pk=self.staff.pk)
        self.client.force_login(self.staff)

        response = self.client.post(
            reverse('admin:auth_user_change', args=[self.staff.pk]),
            {
                'username': self.staff.username,
                'first_name': '',
                'last_name': '',
                'email': self.staff.email,
                'is_active': 'on',
                'date_joined_0': self.staff.date_joined.strftime('%Y-%m-%d'),
                'date_joined_1': self.staff.date_joined.strftime('%H:%M:%S'),
                'profile-TOTAL_FORMS': '1',
                'profile-INITIAL_FORMS': '0',
                'profile-MIN_NUM_FORMS': '0',
                'profile-MAX_NUM_FORMS': '1',
                'profile-0-role': Profile.Role.EDITOR,
                '_save': 'Save',
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertFalse(Profile.objects.filter(user=self.staff).exists())

    def test_superuser_can_manage_privileged_profiles_through_user_inline(self):
        self.client.force_login(self.superuser)

        change_response = self.client.post(
            reverse('admin:auth_user_change', args=[self.privileged_staff.pk]),
            {
                'username': self.privileged_staff.username,
                'first_name': '',
                'last_name': '',
                'email': self.privileged_staff.email,
                'is_active': 'on',
                'date_joined_0': self.privileged_staff.date_joined.strftime(
                    '%Y-%m-%d',
                ),
                'date_joined_1': self.privileged_staff.date_joined.strftime(
                    '%H:%M:%S',
                ),
                'profile-TOTAL_FORMS': '1',
                'profile-INITIAL_FORMS': '1',
                'profile-MIN_NUM_FORMS': '0',
                'profile-MAX_NUM_FORMS': '1',
                'profile-0-id': str(self.privileged_staff_profile.pk),
                'profile-0-role': Profile.Role.EDITOR,
                'userlinkmeta_set-TOTAL_FORMS': '0',
                'userlinkmeta_set-INITIAL_FORMS': '0',
                'userlinkmeta_set-MIN_NUM_FORMS': '0',
                'userlinkmeta_set-MAX_NUM_FORMS': '1000',
                '_save': 'Save',
            },
        )
        add_response = self.client.post(
            reverse(
                'admin:auth_user_change',
                args=[self.privileged_user_without_profile.pk],
            ),
            {
                'username': self.privileged_user_without_profile.username,
                'first_name': '',
                'last_name': '',
                'email': self.privileged_user_without_profile.email,
                'is_active': 'on',
                'date_joined_0': (
                    self.privileged_user_without_profile.date_joined.strftime(
                        '%Y-%m-%d',
                    )
                ),
                'date_joined_1': (
                    self.privileged_user_without_profile.date_joined.strftime(
                        '%H:%M:%S',
                    )
                ),
                'profile-TOTAL_FORMS': '1',
                'profile-INITIAL_FORMS': '0',
                'profile-MIN_NUM_FORMS': '0',
                'profile-MAX_NUM_FORMS': '1',
                'profile-0-role': Profile.Role.EDITOR,
                'userlinkmeta_set-TOTAL_FORMS': '0',
                'userlinkmeta_set-INITIAL_FORMS': '0',
                'userlinkmeta_set-MIN_NUM_FORMS': '0',
                'userlinkmeta_set-MAX_NUM_FORMS': '1000',
                '_save': 'Save',
            },
        )

        self.assertEqual(change_response.status_code, 302)
        self.assertEqual(add_response.status_code, 302)
        self.privileged_staff_profile.refresh_from_db()
        self.assertEqual(self.privileged_staff_profile.role, Profile.Role.EDITOR)
        self.assertEqual(
            Profile.objects.get(
                user=self.privileged_user_without_profile,
            ).role,
            Profile.Role.EDITOR,
        )

    def test_superuser_keeps_privileged_profile_management(self):
        request = self.superuser_request()

        self.assertTrue(
            self.profile_admin.has_change_permission(
                request,
                self.privileged_staff_profile,
            ),
        )
        self.assertTrue(
            self.profile_admin.has_delete_permission(
                request,
                self.privileged_staff_profile,
            ),
        )

        count = self.profile_admin.set_profiles_role(
            request,
            Profile.objects.filter(pk=self.privileged_staff_profile.pk),
            role=Profile.Role.EDITOR,
        )

        self.assertEqual(count, 1)
        self.privileged_staff_profile.refresh_from_db()
        self.assertEqual(self.privileged_staff_profile.role, Profile.Role.EDITOR)

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
        self.assertTrue(
            self.user_admin.has_change_permission(
                request,
                self.privileged_staff,
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

    def test_product_setting_permission_labels_follow_active_language(self):
        expected_model_labels = {
            'en': {
                IntegrationSetting: 'Telegram integration settings',
                LoginSetting: 'Login and security settings',
                SiteSetting: 'Site settings',
                StaticPage: 'Static page',
            },
            'ko': {
                IntegrationSetting: '텔레그램 연동 설정',
                LoginSetting: '로그인·보안 설정',
                SiteSetting: '사이트 설정',
                StaticPage: '정적 페이지',
            },
        }
        actions_by_language = {
            'en': ['Add', 'Change', 'Delete', 'View'],
            'ko': ['추가', '수정', '삭제', '보기'],
        }
        permission_actions = ('add', 'change', 'delete', 'view')

        for language, labels_by_model in expected_model_labels.items():
            with self.subTest(language=language), translation.override(language):
                for model, model_label in labels_by_model.items():
                    content_type = ContentType.objects.get_for_model(model)
                    permissions = list(
                        Permission.objects.select_related('content_type').filter(
                            content_type=content_type,
                            codename__in=[
                                f'{action}_{model._meta.model_name}'
                                for action in permission_actions
                            ],
                        ).order_by('codename'),
                    )
                    expected = [
                        f'{model_label} {action}'
                        if language == 'ko'
                        else f'{action} {model_label}'
                        for action in actions_by_language[language]
                    ]

                    with self.subTest(model=model):
                        for field in self.permission_fields():
                            labels = [
                                field.label_from_instance(permission)
                                for permission in permissions
                            ]
                            self.assertEqual(labels, expected)

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
