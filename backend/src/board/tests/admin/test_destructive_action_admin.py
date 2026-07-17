from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth.models import User
from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.utils import timezone

from board.admin.comment import CommentAdmin
from board.admin.tag import TagAdmin
from board.admin.user import CustomUserAdmin, ProfileAdmin
from board.admin.webhook import WebhookSubscriptionAdmin
from board.models import (
    Comment,
    Post,
    Profile,
    SiteContentScope,
    Tag,
    WebhookSubscription,
)
from board.services.comment_service import CommentService
from board.services.webhook_subscription_state_service import (
    WebhookSubscriptionStateService,
)


class DestructiveActionAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='safety-admin',
            email='safety-admin@example.com',
            password='test',
        )
        cls.staff_user = User.objects.create_user(
            username='safety-staff',
            password='test',
            is_staff=True,
        )
        cls.managed_user = User.objects.create_user(
            username='managed-user',
            password='test',
        )
        cls.author = User.objects.create_user(
            username='comment-author',
            password='test',
        )
        cls.managed_profile, _ = Profile.objects.get_or_create(
            user=cls.managed_user,
            defaults={'role': Profile.Role.EDITOR},
        )
        cls.author_profile, _ = Profile.objects.get_or_create(
            user=cls.author,
        )
        cls.post = Post.objects.create(
            author=cls.author,
            title='Admin safety post',
            url='admin-safety-post',
            published_date=timezone.now(),
        )

    def setUp(self):
        self.user_admin = CustomUserAdmin(User, admin.site)
        self.profile_admin = ProfileAdmin(Profile, admin.site)
        self.comment_admin = CommentAdmin(Comment, admin.site)
        self.tag_admin = TagAdmin(Tag, admin.site)
        self.webhook_admin = WebhookSubscriptionAdmin(
            WebhookSubscription,
            admin.site,
        )

    def admin_request(
        self,
        method: str = 'get',
        data: dict[str, object] | None = None,
        *,
        user: User | None = None,
    ):
        factory_method = getattr(RequestFactory(), method)
        request = factory_method('/admin/', data=data or {})
        request.user = user or self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    @staticmethod
    def action_selection(
        action: str,
        object_ids: list[int],
    ) -> dict[str, object]:
        return {
            helpers.ACTION_CHECKBOX_NAME: [
                str(object_id) for object_id in object_ids
            ],
            'action': action,
            'select_across': '0',
        }

    def create_comment(
        self,
        *,
        parent: Comment | None = None,
        content: str = 'Admin managed comment',
    ) -> Comment:
        return Comment.objects.create(
            author=self.author,
            post=self.post,
            parent=parent,
            text_md=content,
            text_html=f'<p>{content}</p>',
        )

    def create_webhook(
        self,
        *,
        is_active: bool = False,
        failure_count: int = 2,
    ) -> WebhookSubscription:
        return WebhookSubscription.objects.create(
            scope=SiteContentScope.GLOBAL,
            author=None,
            webhook_url=(
                f'https://hooks.example.com/{WebhookSubscription.objects.count()}'
            ),
            name='Admin webhook',
            is_active=is_active,
            failure_count=failure_count,
        )

    def test_user_admin_prevents_direct_delete_and_self_access_changes(self):
        request = self.admin_request()

        self.assertNotIn('delete_selected', self.user_admin.get_actions(request))
        self.assertFalse(
            self.user_admin.has_delete_permission(
                request,
                self.managed_user,
            ),
        )
        self.assertTrue(
            {'is_active', 'is_staff', 'is_superuser'}.issubset(
                self.user_admin.get_readonly_fields(
                    request,
                    self.admin_user,
                ),
            ),
        )

    def test_user_deactivation_confirms_skips_self_and_writes_audit(self):
        selection = self.action_selection(
            'deactivate_users',
            [self.admin_user.pk, self.managed_user.pk],
        )
        queryset = User.objects.filter(
            pk__in=[self.admin_user.pk, self.managed_user.pk],
        )

        confirmation = self.user_admin.deactivate_users(
            self.admin_request('post', selection),
            queryset,
        )

        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()
        self.managed_user.refresh_from_db()
        self.assertTrue(self.managed_user.is_active)

        self.user_admin.deactivate_users(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
            ),
            queryset,
        )

        self.admin_user.refresh_from_db()
        self.managed_user.refresh_from_db()
        self.assertTrue(self.admin_user.is_active)
        self.assertFalse(self.managed_user.is_active)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(self.managed_user.pk),
                action_flag=CHANGE,
                change_message__contains='계정 비활성화',
            ).exists(),
        )
        self.assertFalse(
            LogEntry.objects.filter(
                object_id=str(self.admin_user.pk),
                change_message__contains='계정 비활성화',
            ).exists(),
        )

    def test_user_deactivation_preserves_last_active_superuser(self):
        selection = self.action_selection(
            'deactivate_users',
            [self.admin_user.pk],
        )

        self.assertTrue(
            {'is_active', 'is_staff', 'is_superuser'}.issubset(
                self.user_admin.get_readonly_fields(
                    self.admin_request(user=self.staff_user),
                    self.admin_user,
                ),
            ),
        )

        self.user_admin.deactivate_users(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
                user=self.staff_user,
            ),
            User.objects.filter(pk=self.admin_user.pk),
        )

        self.admin_user.refresh_from_db()
        self.assertTrue(self.admin_user.is_active)

    def test_user_status_change_rolls_back_when_audit_fails(self):
        selection = self.action_selection(
            'deactivate_users',
            [self.managed_user.pk],
        )

        with patch.object(
            self.user_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.user_admin.deactivate_users(
                    self.admin_request(
                        'post',
                        {**selection, 'confirm': 'yes'},
                    ),
                    User.objects.filter(pk=self.managed_user.pk),
                )

        self.managed_user.refresh_from_db()
        self.assertTrue(self.managed_user.is_active)

    def test_user_activation_confirms_and_restores_access(self):
        User.objects.filter(pk=self.managed_user.pk).update(is_active=False)
        selection = self.action_selection(
            'activate_users',
            [self.managed_user.pk],
        )
        queryset = User.objects.filter(pk=self.managed_user.pk)

        confirmation = self.user_admin.activate_users(
            self.admin_request('post', selection),
            queryset,
        )
        self.assertIsInstance(confirmation, TemplateResponse)

        self.user_admin.activate_users(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
            ),
            queryset,
        )

        self.managed_user.refresh_from_db()
        self.assertTrue(self.managed_user.is_active)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(self.managed_user.pk),
                action_flag=CHANGE,
                change_message__contains='계정 활성화',
            ).exists(),
        )

    def test_role_actions_are_audited_and_roll_back_with_the_audit(self):
        self.user_admin.make_reader(
            self.admin_request('post'),
            User.objects.filter(pk=self.managed_user.pk),
        )

        self.managed_profile.refresh_from_db()
        self.assertEqual(self.managed_profile.role, Profile.Role.READER)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(self.managed_user.pk),
                action_flag=CHANGE,
                change_message__contains='독자 역할로 변경',
            ).exists(),
        )

        with patch.object(
            self.profile_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.profile_admin.set_role_editor(
                    self.admin_request('post'),
                    Profile.objects.filter(pk=self.managed_profile.pk),
                )

        self.managed_profile.refresh_from_db()
        self.assertEqual(self.managed_profile.role, Profile.Role.READER)

    def test_comment_delete_uses_soft_delete_and_preserves_replies(self):
        parent = self.create_comment(content='Parent comment')
        reply = self.create_comment(parent=parent, content='Reply comment')
        selection = self.action_selection(
            'soft_delete_comments',
            [parent.pk],
        )
        queryset = Comment.objects.filter(pk=parent.pk)
        request = self.admin_request('post', selection)

        self.assertNotIn(
            'delete_selected',
            self.comment_admin.get_actions(request),
        )
        self.assertFalse(
            self.comment_admin.has_delete_permission(request, parent),
        )
        confirmation = self.comment_admin.soft_delete_comments(
            request,
            queryset,
        )
        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()

        with patch.object(
            CommentService,
            'delete_comment',
            wraps=CommentService.delete_comment,
        ) as delete_comment:
            self.comment_admin.soft_delete_comments(
                self.admin_request(
                    'post',
                    {**selection, 'confirm': 'yes'},
                ),
                queryset,
            )

        delete_comment.assert_called_once()
        parent.refresh_from_db()
        self.assertIsNone(parent.author)
        self.assertTrue(Comment.objects.filter(pk=parent.pk).exists())
        self.assertTrue(Comment.objects.filter(pk=reply.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(parent.pk),
                action_flag=CHANGE,
                change_message__contains='댓글 삭제 상태로 전환',
            ).exists(),
        )
        self.assertFalse(
            LogEntry.objects.filter(
                object_id=str(parent.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_comment_mutations_roll_back_when_audit_fails(self):
        comment = self.create_comment()
        confirmed_delete = {
            **self.action_selection('soft_delete_comments', [comment.pk]),
            'confirm': 'yes',
        }

        with patch.object(
            self.comment_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.comment_admin.soft_delete_comments(
                    self.admin_request('post', confirmed_delete),
                    Comment.objects.filter(pk=comment.pk),
                )

        comment.refresh_from_db()
        self.assertIsNotNone(comment.author)

        self.comment_admin.mark_as_heart(
            self.admin_request('post'),
            Comment.objects.filter(pk=comment.pk),
        )
        comment.refresh_from_db()
        self.assertTrue(comment.heart)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(comment.pk),
                action_flag=CHANGE,
                change_message__contains='하트 표시',
            ).exists(),
        )

    def test_unused_tag_cleanup_confirms_and_keeps_referenced_tags(self):
        used_tag = Tag.objects.create(value='admin-used-tag')
        unused_tag = Tag.objects.create(value='admin-unused-tag')
        self.post.tags.add(used_tag)
        selection = self.action_selection(
            'clear_unused_tags',
            [used_tag.pk, unused_tag.pk],
        )
        queryset = Tag.objects.filter(pk__in=[used_tag.pk, unused_tag.pk])
        request = self.admin_request('post', selection)

        actions = self.tag_admin.get_actions(request)
        self.assertNotIn('delete_selected', actions)
        self.assertNotIn('merge_tags', actions)
        self.assertFalse(
            self.tag_admin.has_delete_permission(request, used_tag),
        )
        confirmation = self.tag_admin.clear_unused_tags(request, queryset)
        self.assertIsInstance(confirmation, TemplateResponse)
        self.assertEqual(confirmation.context_data['object_count'], 1)
        confirmation.render()

        self.tag_admin.clear_unused_tags(
            self.admin_request(
                'post',
                {**selection, 'confirm': 'yes'},
            ),
            queryset,
        )

        self.assertTrue(Tag.objects.filter(pk=used_tag.pk).exists())
        self.assertFalse(Tag.objects.filter(pk=unused_tag.pk).exists())
        self.assertTrue(self.post.tags.filter(pk=used_tag.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(unused_tag.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_unused_tag_cleanup_rolls_back_when_audit_fails(self):
        unused_tag = Tag.objects.create(value='admin-audit-tag')
        confirmed_cleanup = {
            **self.action_selection('clear_unused_tags', [unused_tag.pk]),
            'confirm': 'yes',
        }

        with patch.object(
            self.tag_admin,
            'log_deletions',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.tag_admin.clear_unused_tags(
                    self.admin_request('post', confirmed_cleanup),
                    Tag.objects.filter(pk=unused_tag.pk),
                )

        self.assertTrue(Tag.objects.filter(pk=unused_tag.pk).exists())

    def test_webhook_actions_use_state_service_confirmation_and_audit(self):
        webhook = self.create_webhook()
        selection = self.action_selection(
            'activate_subscriptions',
            [webhook.pk],
        )
        queryset = WebhookSubscription.objects.filter(pk=webhook.pk)
        request = self.admin_request('post', selection)

        self.assertIn(
            'is_active',
            self.webhook_admin.get_readonly_fields(request, webhook),
        )
        confirmation = self.webhook_admin.activate_subscriptions(
            request,
            queryset,
        )
        self.assertIsInstance(confirmation, TemplateResponse)

        with patch.object(
            WebhookSubscriptionStateService,
            'set_active',
            wraps=WebhookSubscriptionStateService.set_active,
        ) as set_active:
            self.webhook_admin.activate_subscriptions(
                self.admin_request(
                    'post',
                    {**selection, 'confirm': 'yes'},
                ),
                queryset,
            )

        set_active.assert_called_once()
        webhook.refresh_from_db()
        self.assertTrue(webhook.is_active)
        self.assertEqual(webhook.failure_count, 2)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(webhook.pk),
                action_flag=CHANGE,
                change_message__contains='웹훅 활성화',
            ).exists(),
        )

        WebhookSubscription.objects.filter(pk=webhook.pk).update(
            is_active=False,
            failure_count=3,
        )
        reset_selection = self.action_selection(
            'reset_failure_count',
            [webhook.pk],
        )
        reset_confirmation = self.webhook_admin.reset_failure_count(
            self.admin_request('post', reset_selection),
            queryset,
        )
        self.assertIsInstance(reset_confirmation, TemplateResponse)

        self.webhook_admin.reset_failure_count(
            self.admin_request(
                'post',
                {**reset_selection, 'confirm': 'yes'},
            ),
            queryset,
        )
        webhook.refresh_from_db()
        self.assertTrue(webhook.is_active)
        self.assertEqual(webhook.failure_count, 0)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(webhook.pk),
                action_flag=CHANGE,
                change_message__contains='실패 횟수 초기화',
            ).exists(),
        )

        self.webhook_admin.deactivate_subscriptions(
            self.admin_request('post'),
            queryset,
        )
        webhook.refresh_from_db()
        self.assertFalse(webhook.is_active)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(webhook.pk),
                action_flag=CHANGE,
                change_message__contains='웹훅 비활성화',
            ).exists(),
        )

    def test_webhook_activation_rolls_back_when_audit_fails(self):
        webhook = self.create_webhook()
        confirmed_activation = {
            **self.action_selection(
                'activate_subscriptions',
                [webhook.pk],
            ),
            'confirm': 'yes',
        }

        with patch.object(
            self.webhook_admin,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.webhook_admin.activate_subscriptions(
                    self.admin_request('post', confirmed_activation),
                    WebhookSubscription.objects.filter(pk=webhook.pk),
                )

        webhook.refresh_from_db()
        self.assertFalse(webhook.is_active)
        self.assertEqual(webhook.failure_count, 2)
