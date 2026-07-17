from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import CHANGE, DELETION, LogEntry
from django.contrib.auth.models import User
from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from board.admin.post import PostAdmin
from board.models import (
    EditHistory,
    Post,
    PostConfig,
    PostConfigMeta,
    PostContent,
    Tag,
)
from board.services.post_service import PostService


class DummyAdminForm:
    def __init__(self, instance: Post, *, changed: bool):
        self.instance = instance
        self._changed = changed

    def has_changed(self):
        return self._changed

    def save_m2m(self):
        return None


class DummyInlineFormSet:
    def __init__(self, *, changed: bool, save_callback=None):
        self._changed = changed
        self._save_callback = save_callback

    def has_changed(self):
        return self._changed

    def save(self):
        if self._save_callback:
            self._save_callback()
        return []


class AdminRequestMixin:
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='admin-operator',
            email='admin@example.com',
            password='test',
        )
        cls.author = User.objects.create_user(
            username='post-author',
            password='test',
        )

    def admin_request(self, method='get', data=None, path='/admin/board/post/'):
        factory_method = getattr(RequestFactory(), method)
        request = factory_method(path, data=data or {})
        request.user = self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    def create_post(self, *, published=True, title='Admin post'):
        published_date = timezone.now() if published else None
        post = Post.objects.create(
            author=self.author,
            title=title,
            url=f'{title.lower().replace(" ", "-")}-{Post.all_objects.count()}',
            published_date=published_date,
            updated_date=timezone.now() - timedelta(days=1),
        )
        PostContent.objects.create(
            post=post,
            content_html='<p>Original body</p>',
        )
        PostConfig.objects.create(post=post)
        return post


class PostAdminTestCase(AdminRequestMixin, TestCase):
    def setUp(self):
        self.admin_instance = PostAdmin(Post, admin.site)

    def test_url_is_not_readonly_field(self):
        request = self.admin_request()

        readonly_fields = self.admin_instance.get_readonly_fields(
            request,
            obj=None,
        )

        self.assertNotIn('url', readonly_fields)

    def test_queryset_includes_trash_but_autocomplete_excludes_it(self):
        active = self.create_post(title='Active post')
        trashed = self.create_post(title='Trashed post')
        Post.all_objects.filter(pk=trashed.pk).update(
            deleted_date=timezone.now(),
        )

        regular_request = self.admin_request()
        queryset = self.admin_instance.get_queryset(regular_request)
        self.assertSetEqual(
            set(queryset.values_list('pk', flat=True)),
            {active.pk, trashed.pk},
        )
        trashed_from_admin = queryset.get(pk=trashed.pk)
        self.assertIn(
            '휴지통',
            str(self.admin_instance.publish_status(trashed_from_admin)),
        )

        autocomplete_request = self.admin_request()
        autocomplete_request.resolver_match = SimpleNamespace(
            url_name='autocomplete',
        )
        autocomplete_queryset = self.admin_instance.get_queryset(
            autocomplete_request,
        )
        self.assertSetEqual(
            set(autocomplete_queryset.values_list('pk', flat=True)),
            {active.pk},
        )

    def test_changelist_keeps_active_default_and_exposes_trash_filter(self):
        active = self.create_post(title='Visible active row')
        trashed = self.create_post(title='Visible trash row')
        Post.all_objects.filter(pk=trashed.pk).update(
            deleted_date=timezone.now(),
        )
        self.client.force_login(self.admin_user)
        changelist_url = reverse('admin:board_post_changelist')

        default_response = self.client.get(changelist_url)
        self.assertEqual(default_response.status_code, 200)
        self.assertContains(default_response, active.title)
        self.assertNotContains(default_response, trashed.title)

        trash_response = self.client.get(
            changelist_url,
            {'publish_status': 'trashed'},
        )
        self.assertEqual(trash_response.status_code, 200)
        self.assertNotContains(trash_response, active.title)
        self.assertContains(trash_response, trashed.title)

        invalid_filter_response = self.client.get(
            changelist_url,
            {'publish_status': 'unknown'},
        )
        self.assertEqual(invalid_filter_response.status_code, 200)
        self.assertContains(invalid_filter_response, active.title)
        self.assertNotContains(invalid_filter_response, trashed.title)

    def test_trashed_post_is_viewable_but_not_editable_or_directly_deletable(self):
        post = self.create_post()
        Post.all_objects.filter(pk=post.pk).update(
            deleted_date=timezone.now(),
        )
        post = Post.all_objects.get(pk=post.pk)
        request = self.admin_request()

        self.assertFalse(
            self.admin_instance.has_change_permission(request, post),
        )
        self.assertFalse(
            self.admin_instance.has_delete_permission(request, post),
        )
        self.client.force_login(self.admin_user)
        response = self.client.get(
            reverse('admin:board_post_change', args=[post.pk]),
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'name="_save"')

    def test_default_bulk_delete_is_replaced_with_lifecycle_actions(self):
        actions = self.admin_instance.get_actions(self.admin_request())

        self.assertNotIn('delete_selected', actions)
        self.assertIn('move_to_trash', actions)
        self.assertIn('restore_from_trash', actions)
        self.assertIn('permanently_delete_trashed', actions)

    def test_move_to_trash_and_restore_use_recoverable_state(self):
        post = self.create_post()
        original_updated_date = post.updated_date

        self.admin_instance.move_to_trash(
            self.admin_request('post'),
            Post.all_objects.filter(pk=post.pk),
        )

        trashed = Post.all_objects.get(pk=post.pk)
        self.assertIsNotNone(trashed.deleted_date)
        self.assertEqual(trashed.updated_date, original_updated_date)
        self.assertFalse(Post.objects.filter(pk=post.pk).exists())

        self.admin_instance.restore_from_trash(
            self.admin_request('post'),
            Post.all_objects.filter(pk=post.pk),
        )

        restored = Post.objects.get(pk=post.pk)
        self.assertIsNone(restored.deleted_date)
        self.assertEqual(restored.updated_date, original_updated_date)
        logs = LogEntry.objects.filter(
            object_id=str(post.pk),
            action_flag=CHANGE,
        )
        self.assertEqual(logs.count(), 2)
        self.assertTrue(
            logs.filter(change_message__contains='휴지통으로 이동').exists(),
        )
        self.assertTrue(
            logs.filter(change_message__contains='휴지통 복원').exists(),
        )

    def test_permanent_delete_requires_confirmation_and_only_accepts_trash(self):
        active = self.create_post(title='Keep active')
        trashed = self.create_post(title='Purge trashed')
        Post.all_objects.filter(pk=trashed.pk).update(
            deleted_date=timezone.now(),
        )
        queryset = Post.all_objects.filter(pk__in=[active.pk, trashed.pk])
        selection = {
            helpers.ACTION_CHECKBOX_NAME: [str(active.pk), str(trashed.pk)],
            'action': 'permanently_delete_trashed',
            'select_across': '0',
        }

        confirmation = self.admin_instance.permanently_delete_trashed(
            self.admin_request('post', selection),
            queryset,
        )

        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()
        self.assertTrue(Post.all_objects.filter(pk=trashed.pk).exists())

        confirmed_request = self.admin_request(
            'post',
            {**selection, 'confirm': 'yes'},
        )
        self.admin_instance.permanently_delete_trashed(
            confirmed_request,
            queryset,
        )

        self.assertTrue(Post.all_objects.filter(pk=active.pk).exists())
        self.assertFalse(Post.all_objects.filter(pk=trashed.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(trashed.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_publish_drafts_uses_service_timestamp_contract(self):
        draft = self.create_post(published=False, title='Publish draft')
        previous_updated_date = draft.updated_date
        saved_reservation = timezone.now() + timedelta(days=2)
        PostConfigMeta.objects.create(
            post=draft,
            name=PostService.DRAFT_RESERVED_DATE_META,
            value=saved_reservation.isoformat(),
        )

        self.admin_instance.publish_drafts(
            self.admin_request('post'),
            Post.all_objects.filter(pk=draft.pk),
        )

        published = Post.objects.get(pk=draft.pk)
        self.assertIsNotNone(published.published_date)
        self.assertLess(published.published_date, saved_reservation)
        self.assertGreater(published.updated_date, previous_updated_date)
        self.assertFalse(
            PostConfigMeta.objects.filter(
                post=draft,
                name=PostService.DRAFT_RESERVED_DATE_META,
            ).exists(),
        )
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(draft.pk),
                action_flag=CHANGE,
                change_message__contains='즉시 발행',
            ).exists(),
        )

    def test_failed_immediate_publish_restores_saved_reservation(self):
        draft = self.create_post(published=False, title='Broken draft')
        draft.config.delete()
        saved_reservation = timezone.now() + timedelta(days=2)
        PostConfigMeta.objects.create(
            post=draft,
            name=PostService.DRAFT_RESERVED_DATE_META,
            value=saved_reservation.isoformat(),
        )

        self.admin_instance.publish_drafts(
            self.admin_request('post'),
            Post.all_objects.filter(pk=draft.pk),
        )

        draft.refresh_from_db()
        self.assertIsNone(draft.published_date)
        self.assertEqual(
            PostConfigMeta.objects.get(
                post=draft,
                name=PostService.DRAFT_RESERVED_DATE_META,
            ).value,
            saved_reservation.isoformat(),
        )

    def test_visibility_actions_use_service_and_skip_trash(self):
        active = self.create_post(title='Visibility active')
        trashed = self.create_post(title='Visibility trashed')
        Post.all_objects.filter(pk=trashed.pk).update(
            deleted_date=timezone.now(),
        )
        previous_updated_date = active.updated_date

        self.admin_instance.make_hidden(
            self.admin_request('post'),
            Post.all_objects.filter(pk__in=[active.pk, trashed.pk]),
        )

        active.refresh_from_db()
        trashed.config.refresh_from_db()
        self.assertTrue(active.config.hide)
        self.assertFalse(trashed.config.hide)
        self.assertGreater(active.updated_date, previous_updated_date)
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(active.pk),
                action_flag=CHANGE,
                change_message__contains='숨김 처리',
            ).exists(),
        )

    def test_visibility_change_rolls_back_when_audit_log_fails(self):
        post = self.create_post(title='Audit rollback')

        with patch.object(
            self.admin_instance,
            'log_change',
            side_effect=RuntimeError('audit unavailable'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit unavailable'):
                self.admin_instance.make_hidden(
                    self.admin_request('post'),
                    Post.all_objects.filter(pk=post.pk),
                )

        post.config.refresh_from_db()
        self.assertFalse(post.config.hide)

    def test_admin_edit_records_operator_revision_and_updates_timestamp(self):
        post = self.create_post(title='Original title')
        tag = Tag.objects.create(value='original-tag')
        post.tags.add(tag)
        previous_updated_date = post.updated_date
        post.title = 'Changed in Admin'
        form = DummyAdminForm(post, changed=True)
        request = self.admin_request('post')

        self.admin_instance.save_model(request, post, form, change=True)
        self.admin_instance.save_related(
            request,
            form,
            [],
            change=True,
        )

        post.refresh_from_db()
        revision = EditHistory.objects.get(post=post)
        self.assertEqual(revision.title, 'Original title')
        self.assertEqual(revision.content, '<p>Original body</p>')
        self.assertEqual(revision.tags, ['original-tag'])
        self.assertEqual(revision.actor, self.admin_user)
        self.assertEqual(
            revision.source_updated_date,
            previous_updated_date,
        )
        self.assertGreater(post.updated_date, previous_updated_date)

    def test_admin_inline_edit_records_revision_but_draft_edit_does_not(self):
        published = self.create_post(title='Published inline')
        published_previous_date = published.updated_date
        published_form = DummyAdminForm(published, changed=False)
        published_formset = DummyInlineFormSet(
            changed=True,
            save_callback=lambda: PostContent.objects.filter(
                post=published,
            ).update(content_html='<p>Changed inline body</p>'),
        )
        request = self.admin_request('post')

        self.admin_instance.save_model(
            request,
            published,
            published_form,
            change=True,
        )
        self.admin_instance.save_related(
            request,
            published_form,
            [published_formset],
            change=True,
        )

        published.refresh_from_db()
        self.assertEqual(
            EditHistory.objects.get(post=published).content,
            '<p>Original body</p>',
        )
        self.assertGreater(
            published.updated_date,
            published_previous_date,
        )

        draft = self.create_post(published=False, title='Draft inline')
        draft_previous_date = draft.updated_date
        draft.title = 'Changed draft title'
        draft_form = DummyAdminForm(draft, changed=True)
        self.admin_instance.save_model(
            request,
            draft,
            draft_form,
            change=True,
        )
        self.admin_instance.save_related(
            request,
            draft_form,
            [],
            change=True,
        )

        draft.refresh_from_db()
        self.assertFalse(EditHistory.objects.filter(post=draft).exists())
        self.assertGreater(draft.updated_date, draft_previous_date)
