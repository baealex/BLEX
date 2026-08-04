from unittest.mock import patch

from django.contrib import admin
from django.contrib.admin import helpers
from django.contrib.admin.models import DELETION, LogEntry
from django.contrib.auth.models import User
from django.contrib.messages.storage.fallback import FallbackStorage
from django.template.response import TemplateResponse
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone, translation

from board.admin.revision import EditHistoryAdmin
from board.models import EditHistory, Post
from board.services.post_revision_service import PostRevisionService


class EditHistoryAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='revision-admin',
            email='revision-admin@example.com',
            password='test',
        )
        cls.author = User.objects.create_user(
            username='revision-author',
            password='test',
        )

    def setUp(self):
        self.admin_instance = EditHistoryAdmin(EditHistory, admin.site)

    def admin_request(self, method='get', data=None):
        factory_method = getattr(RequestFactory(), method)
        request = factory_method(
            '/admin/board/edithistory/',
            data=data or {},
        )
        request.user = self.admin_user
        request.session = {}
        request._messages = FallbackStorage(request)
        return request

    def create_post(self, title: str, *, trashed: bool = False) -> Post:
        post = Post.objects.create(
            author=self.author,
            title=title,
            url=title.lower().replace(' ', '-'),
            published_date=timezone.now(),
        )
        if trashed:
            Post.all_objects.filter(pk=post.pk).update(
                deleted_date=timezone.now(),
            )
            return Post.all_objects.get(pk=post.pk)
        return post

    def create_revision(
        self,
        post: Post,
        *,
        title='Previous title',
        excerpt='Previous body',
        actor=None,
    ) -> EditHistory:
        return EditHistory.objects.create(
            post=post,
            actor=actor if actor is not None else self.author,
            title=title,
            content='<p>Previous body</p>',
            content_excerpt=excerpt,
            change_type=EditHistory.ChangeType.EDIT,
            source_updated_date=timezone.now(),
        )

    def test_snapshots_cannot_be_added_or_edited_in_admin(self):
        post = self.create_post('Immutable revision')
        revision = self.create_revision(post)
        request = self.admin_request()

        self.assertFalse(self.admin_instance.has_add_permission(request))
        self.assertFalse(
            self.admin_instance.has_change_permission(request, revision),
        )
        self.assertSetEqual(
            set(self.admin_instance.get_readonly_fields(request, revision)),
            {
                field.name
                for field in EditHistory._meta.fields
                if not field.primary_key
            },
        )

        actions = self.admin_instance.get_actions(request)
        self.assertNotIn('delete_selected', actions)
        self.assertIn('delete_revisions', actions)

        self.client.force_login(self.admin_user)
        change_response = self.client.get(
            reverse('admin:board_edithistory_change', args=[revision.pk]),
        )
        self.assertEqual(change_response.status_code, 200)
        self.assertNotContains(change_response, 'name="_save"')

        with self.assertLogs('django.request', level='WARNING'):
            add_response = self.client.get(
                reverse('admin:board_edithistory_add'),
            )
        self.assertEqual(add_response.status_code, 403)

    def test_changelist_identifies_post_lifecycle_actor_and_change_type(self):
        active_post = self.create_post('Active revision post')
        trashed_post = self.create_post(
            'Trashed revision post',
            trashed=True,
        )
        active_revision = self.create_revision(
            active_post,
            actor=self.admin_user,
        )
        trashed_revision = self.create_revision(trashed_post)
        self.client.force_login(self.admin_user)
        changelist_url = reverse('admin:board_edithistory_changelist')

        response = self.client.get(changelist_url)
        self.assertEqual(response.status_code, 200)
        self.assertSetEqual(
            {revision.pk for revision in response.context['cl'].result_list},
            {active_revision.pk, trashed_revision.pk},
        )
        for revision in response.context['cl'].result_list:
            self.assertTrue(
                {'content', 'description', 'tags', 'subtitle'}.issubset(
                    revision.get_deferred_fields(),
                ),
            )
        self.assertContains(response, 'revision-admin')
        self.assertContains(response, '수정 전')
        self.assertContains(response, '휴지통')
        self.assertContains(
            response,
            reverse('admin:board_post_change', args=[trashed_post.pk]),
        )

        trash_response = self.client.get(
            changelist_url,
            {'post_status': 'trashed'},
        )
        self.assertEqual(trash_response.status_code, 200)
        self.assertEqual(
            [revision.pk for revision in trash_response.context['cl'].result_list],
            [trashed_revision.pk],
        )

        active_response = self.client.get(
            changelist_url,
            {'post_status': 'active'},
        )
        self.assertEqual(
            [revision.pk for revision in active_response.context['cl'].result_list],
            [active_revision.pk],
        )

    def test_changelist_uses_active_locale_and_preserves_snapshot_content(self):
        post = self.create_post('Localized revision post')
        self.create_revision(
            post,
            title='사용자가 작성한 제목',
            excerpt='Texte rédigé par l’utilisateur',
        )
        self.client.force_login(self.admin_user)

        with translation.override('en'):
            response = self.client.get(
                reverse('admin:board_edithistory_changelist'),
                HTTP_ACCEPT_LANGUAGE='en',
            )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Before edit')
        self.assertContains(response, 'Previous content')
        self.assertContains(response, '사용자가 작성한 제목')
        self.assertContains(response, 'Texte rédigé par l’utilisateur')
        self.assertNotContains(response, '수정 전')

    def test_snapshot_summary_escapes_stored_html(self):
        post = self.create_post('Escaped revision post')
        self.create_revision(
            post,
            title='<img src=x onerror=alert(1)>',
            excerpt='<script>alert(1)</script>',
        )
        self.client.force_login(self.admin_user)

        response = self.client.get(
            reverse('admin:board_edithistory_changelist'),
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, '<img src=x onerror=alert(1)>')
        self.assertNotContains(response, '<script>alert(1)</script>')
        self.assertContains(
            response,
            '&lt;img src=x onerror=alert(1)>',
            html=False,
        )
        self.assertContains(
            response,
            '&lt;script>alert(1)&lt;/script>',
            html=False,
        )

    def test_bulk_delete_requires_confirmation_and_preserves_post(self):
        post = self.create_post('Revision deletion post')
        deleted_revision = self.create_revision(
            post,
            title='Delete this revision',
        )
        retained_revision = self.create_revision(
            post,
            title='Keep this revision',
        )
        selection = {
            helpers.ACTION_CHECKBOX_NAME: [str(deleted_revision.pk)],
            'action': 'delete_revisions',
            'select_across': '0',
        }
        queryset = EditHistory.objects.filter(pk=deleted_revision.pk)

        confirmation = self.admin_instance.delete_revisions(
            self.admin_request('post', selection),
            queryset,
        )

        self.assertIsInstance(confirmation, TemplateResponse)
        confirmation.render()
        self.assertTrue(
            EditHistory.objects.filter(pk=deleted_revision.pk).exists(),
        )

        with patch.object(
            PostRevisionService,
            'delete_revision',
            wraps=PostRevisionService.delete_revision,
        ) as delete_revision:
            self.admin_instance.delete_revisions(
                self.admin_request(
                    'post',
                    {**selection, 'confirm': 'yes'},
                ),
                queryset,
            )

        delete_revision.assert_called_once()
        self.assertFalse(
            EditHistory.objects.filter(pk=deleted_revision.pk).exists(),
        )
        self.assertTrue(
            EditHistory.objects.filter(pk=retained_revision.pk).exists(),
        )
        self.assertTrue(Post.all_objects.filter(pk=post.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(deleted_revision.pk),
                action_flag=DELETION,
            ).exists(),
        )

    def test_direct_delete_confirms_then_uses_service_and_preserves_post(self):
        post = self.create_post('Direct revision deletion')
        revision = self.create_revision(post)
        delete_url = reverse(
            'admin:board_edithistory_delete',
            args=[revision.pk],
        )
        self.client.force_login(self.admin_user)

        confirmation = self.client.get(delete_url)
        self.assertEqual(confirmation.status_code, 200)
        self.assertContains(confirmation, '삭제하시겠습니까?')
        self.assertTrue(EditHistory.objects.filter(pk=revision.pk).exists())

        with patch.object(
            PostRevisionService,
            'delete_revision',
            wraps=PostRevisionService.delete_revision,
        ) as delete_revision:
            response = self.client.post(
                delete_url,
                {'post': 'yes'},
            )

        self.assertEqual(response.status_code, 302)
        delete_revision.assert_called_once()
        self.assertFalse(EditHistory.objects.filter(pk=revision.pk).exists())
        self.assertTrue(Post.all_objects.filter(pk=post.pk).exists())
        self.assertTrue(
            LogEntry.objects.filter(
                object_id=str(revision.pk),
                action_flag=DELETION,
            ).exists(),
        )
