from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth.models import User
from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from board.admin.auth import SocialAuthAdmin, TwoFactorAuthAdmin
from board.admin.comment import CommentAdmin
from board.admin.form import FormAdmin
from board.admin.user import EmailChangeAdmin, UsernameChangeLogAdmin
from board.models import (
    Comment,
    EmailChange,
    Form,
    Post,
    SocialAuth,
    SocialAuthProvider,
    TwoFactorAuth,
    UsernameChangeLog,
)
from board.services.email_change_service import EmailChangeService
from board.services.social_auth_connection_service import (
    SocialAuthConnectionService,
)
from board.services.two_factor_setup_service import TwoFactorSetupService


class SystemRecordAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='system-admin',
            email='system-admin@example.com',
            password='test',
        )
        cls.user = User.objects.create_user(
            username='account-owner',
            email='current@example.com',
            password='usable-password',
        )
        cls.passwordless_user = User.objects.create_user(
            username='social-only',
            email='social-only@example.com',
            password=None,
        )
        cls.provider = SocialAuthProvider.objects.get(key='github')

    def setUp(self):
        self.email_admin = EmailChangeAdmin(EmailChange, admin.site)
        self.username_admin = UsernameChangeLogAdmin(
            UsernameChangeLog,
            admin.site,
        )
        self.two_factor_admin = TwoFactorAuthAdmin(
            TwoFactorAuth,
            admin.site,
        )
        self.social_admin = SocialAuthAdmin(SocialAuth, admin.site)
        self.form_admin = FormAdmin(Form, admin.site)
        self.comment_admin = CommentAdmin(Comment, admin.site)

    def admin_request(self, method='get', data=None, path='/admin/'):
        factory_method = getattr(RequestFactory(), method)
        request = factory_method(path, data=data or {})
        request.user = self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    @staticmethod
    def action_selection(action: str, object_id: int) -> dict[str, object]:
        return {
            helpers.ACTION_CHECKBOX_NAME: [str(object_id)],
            'action': action,
            'select_across': '0',
        }

    def create_two_factor_auth(self, *, old_enough=True) -> TwoFactorAuth:
        created_date = timezone.now()
        if old_enough:
            created_date -= timedelta(days=2)
        return TwoFactorAuth.objects.create(
            user=self.user,
            recovery_key='recovery-key-secret',
            totp_secret='totp-secret-value',
            created_date=created_date,
        )

    def create_social_auth(self, *, passwordless=False) -> SocialAuth:
        user = self.passwordless_user if passwordless else self.user
        return SocialAuth.objects.create(
            user=user,
            provider=self.provider,
            uid=f'external-identity-secret-{user.pk}',
            extra_data='{"access_token":"provider-token-secret"}',
        )

    def create_comment(self) -> Comment:
        post = Post.objects.create(
            author=self.user,
            title='Comment admin post',
            url='comment-admin-post',
            published_date=timezone.now(),
        )
        return Comment.objects.create(
            author=self.user,
            post=post,
            text_md='Legacy comment',
            text_html=(
                '<p>First line<br>Second line</p>'
                '<script>alert("admin-xss")</script>'
            ),
        )

    def test_system_owned_records_have_no_add_or_edit_surface(self):
        email_change = EmailChange.objects.create(
            user=self.user,
            email='next@example.com',
            auth_token='12345678',
        )
        username_log = UsernameChangeLog.objects.create(
            user=self.user,
            username='old-username',
        )
        two_factor_auth = self.create_two_factor_auth()
        social_auth = self.create_social_auth()
        form = Form.objects.create(
            user=self.user,
            title='User form',
            content='<p>User-owned content</p>',
        )
        comment = self.create_comment()
        request = self.admin_request()

        records = [
            (self.email_admin, email_change),
            (self.username_admin, username_log),
            (self.two_factor_admin, two_factor_auth),
            (self.social_admin, social_auth),
            (self.form_admin, form),
            (self.comment_admin, comment),
        ]
        for model_admin, record in records:
            with self.subTest(model=type(record).__name__):
                self.assertFalse(model_admin.has_add_permission(request))
                self.assertFalse(
                    model_admin.has_change_permission(request, record),
                )

        self.assertFalse(
            self.username_admin.has_delete_permission(request, username_log),
        )
        self.assertFalse(self.form_admin.has_delete_permission(request, form))
        self.assertFalse(
            self.email_admin.has_delete_permission(request, email_change),
        )
        self.assertFalse(
            self.two_factor_admin.has_delete_permission(
                request,
                two_factor_auth,
            ),
        )
        self.assertFalse(
            self.social_admin.has_delete_permission(request, social_auth),
        )

        self.assertNotIn(
            'delete_selected',
            self.email_admin.get_actions(request),
        )
        self.assertNotIn(
            'delete_selected',
            self.two_factor_admin.get_actions(request),
        )
        self.assertNotIn(
            'delete_selected',
            self.social_admin.get_actions(request),
        )

    def test_sensitive_auth_values_are_not_loaded_or_rendered(self):
        email_change = EmailChange.objects.create(
            user=self.user,
            email='next@example.com',
            auth_token='87654321',
        )
        two_factor_auth = self.create_two_factor_auth()
        social_auth = self.create_social_auth()
        two_factor_auth.refresh_from_db()
        stored_recovery_key = two_factor_auth.recovery_key
        stored_totp_secret = two_factor_auth.totp_secret

        email_request = self.admin_request()
        email_request.resolver_match = SimpleNamespace(
            url_name='board_emailchange_changelist',
        )
        loaded_email = self.email_admin.get_queryset(email_request).get(
            pk=email_change.pk,
        )
        self.assertIn('auth_token', loaded_email.get_deferred_fields())

        two_factor_request = self.admin_request()
        loaded_two_factor = self.two_factor_admin.get_queryset(
            two_factor_request,
        ).get(pk=two_factor_auth.pk)
        self.assertTrue(
            {'recovery_key', 'totp_secret'}.issubset(
                loaded_two_factor.get_deferred_fields(),
            ),
        )

        social_request = self.admin_request()
        loaded_social = self.social_admin.get_queryset(social_request).get(
            pk=social_auth.pk,
        )
        self.assertTrue(
            {'uid', 'extra_data'}.issubset(
                loaded_social.get_deferred_fields(),
            ),
        )

        self.client.force_login(self.admin_user)
        responses = [
            self.client.get(
                reverse(
                    'admin:board_emailchange_change',
                    args=[email_change.pk],
                ),
            ),
            self.client.get(
                reverse(
                    'admin:board_twofactorauth_change',
                    args=[two_factor_auth.pk],
                ),
            ),
            self.client.get(
                reverse(
                    'admin:board_socialauth_change',
                    args=[social_auth.pk],
                ),
            ),
        ]
        for response in responses:
            self.assertEqual(response.status_code, 200)
            self.assertNotContains(response, 'name="_save"')

        rendered = b''.join(response.content for response in responses)
        for secret in (
            b'87654321',
            stored_recovery_key.encode(),
            stored_totp_secret.encode(),
            f'external-identity-secret-{self.user.pk}'.encode(),
            b'provider-token-secret',
        ):
            self.assertNotIn(secret, rendered)

    def test_email_change_cancel_requires_confirmation_and_keeps_user_email(self):
        pending_change = EmailChange.objects.create(
            user=self.user,
            email='next@example.com',
            auth_token='12345678',
        )
        action = 'cancel_email_changes'
        selection = self.action_selection(action, pending_change.pk)
        queryset = EmailChange.objects.filter(pk=pending_change.pk)

        confirmation = self.email_admin.cancel_email_changes(
            self.admin_request('post', selection),
            queryset,
        )
        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()
        self.assertTrue(queryset.exists())

        with patch.object(
            EmailChangeService,
            'cancel_pending_change',
            wraps=EmailChangeService.cancel_pending_change,
        ) as cancel_pending_change:
            self.email_admin.cancel_email_changes(
                self.admin_request(
                    'post',
                    {**selection, 'confirm': 'yes'},
                ),
                queryset,
            )

        cancel_pending_change.assert_called_once()
        self.assertFalse(EmailChange.objects.filter(pk=pending_change.pk).exists())
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'current@example.com')
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(pending_change.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_two_factor_disable_uses_existing_policy_and_audit_log(self):
        two_factor_auth = self.create_two_factor_auth()
        action = 'disable_two_factor_auth'
        selection = self.action_selection(action, two_factor_auth.pk)
        queryset = TwoFactorAuth.objects.filter(pk=two_factor_auth.pk)

        confirmation = self.two_factor_admin.disable_two_factor_auth(
            self.admin_request('post', selection),
            queryset,
        )
        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()

        with patch.object(
            TwoFactorSetupService,
            'disable',
            wraps=TwoFactorSetupService.disable,
        ) as disable:
            self.two_factor_admin.disable_two_factor_auth(
                self.admin_request(
                    'post',
                    {**selection, 'confirm': 'yes'},
                ),
                queryset,
            )

        disable.assert_called_once()
        self.assertFalse(
            TwoFactorAuth.objects.filter(pk=two_factor_auth.pk).exists(),
        )
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(two_factor_auth.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_two_factor_disable_keeps_recent_setup(self):
        two_factor_auth = self.create_two_factor_auth(old_enough=False)
        selection = self.action_selection(
            'disable_two_factor_auth',
            two_factor_auth.pk,
        )

        self.two_factor_admin.disable_two_factor_auth(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
            ),
            TwoFactorAuth.objects.filter(pk=two_factor_auth.pk),
        )

        self.assertTrue(
            TwoFactorAuth.objects.filter(pk=two_factor_auth.pk).exists(),
        )
        self.assertFalse(
            LogEntry.objects.filter(
                object_id=str(two_factor_auth.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_social_disconnect_preserves_at_least_one_login_method(self):
        safe_connection = self.create_social_auth()
        locked_connection = self.create_social_auth(passwordless=True)

        for connection, should_disconnect in (
            (safe_connection, True),
            (locked_connection, False),
        ):
            selection = self.action_selection(
                'disconnect_social_auth',
                connection.pk,
            )
            queryset = SocialAuth.objects.filter(pk=connection.pk)
            with patch.object(
                SocialAuthConnectionService,
                'disconnect',
                wraps=SocialAuthConnectionService.disconnect,
            ) as disconnect:
                self.social_admin.disconnect_social_auth(
                    self.admin_request(
                        'post',
                        {**selection, 'confirm': 'yes'},
                    ),
                    queryset,
                )

            disconnect.assert_called_once()
            self.assertEqual(
                SocialAuth.objects.filter(pk=connection.pk).exists(),
                not should_disconnect,
            )
            self.assertEqual(
                LogEntry.objects.filter(
                    object_id=str(connection.pk),
                    action_flag=DELETION,
                ).exists(),
                should_disconnect,
            )

        self.assertTrue(
            User.objects.filter(pk=self.passwordless_user.pk).exists(),
        )

    def test_social_disconnect_allows_another_social_login_to_remain(self):
        selected_connection = self.create_social_auth(passwordless=True)
        other_provider = SocialAuthProvider.objects.get(key='google')
        retained_connection = SocialAuth.objects.create(
            user=self.passwordless_user,
            provider=other_provider,
            uid='retained-google-identity',
            extra_data='{}',
        )
        selection = self.action_selection(
            'disconnect_social_auth',
            selected_connection.pk,
        )

        self.social_admin.disconnect_social_auth(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
            ),
            SocialAuth.objects.filter(pk=selected_connection.pk),
        )

        self.assertFalse(
            SocialAuth.objects.filter(pk=selected_connection.pk).exists(),
        )
        self.assertTrue(
            SocialAuth.objects.filter(pk=retained_connection.pk).exists(),
        )

    def test_comment_preview_is_plain_text_and_preserves_line_breaks(self):
        comment = self.create_comment()
        preview = str(self.comment_admin.text_html_preview(comment))

        self.assertNotIn('<script>', preview)
        self.assertNotIn('<br>', preview)
        self.assertIn('First line\nSecond line', preview)
        self.assertIn('alert(&quot;admin-xss&quot;)', preview)
