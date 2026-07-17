from types import SimpleNamespace

from django.contrib import admin
from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.urls import reverse
from django.utils import timezone

from board.admin.connection import TelegramSyncAdmin
from board.admin.image import ImageCacheAdmin
from board.admin.post import EditRequestAdmin, PinnedPostAdmin, PostAdmin
from board.models import (
    EditRequest,
    ImageCache,
    PinnedPost,
    Post,
    PostConfig,
    PostContent,
    TelegramSync,
)


class DummyPostAdminForm:
    def __init__(self, instance):
        self.instance = instance

    def save_m2m(self):
        return None


class ManagedRecordAdminTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='managed-record-admin',
            email='managed-record-admin@example.com',
            password='test',
        )
        cls.user = User.objects.create_user(
            username='managed-record-owner',
            password='test',
        )
        cls.post = Post.objects.create(
            author=cls.user,
            title='Managed record post',
            url='managed-record-post',
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=cls.post,
            content_html='<p>Managed post</p>',
        )
        PostConfig.objects.create(post=cls.post)
        cls.telegram = TelegramSync.objects.create(
            user=cls.user,
            tid='telegram-chat-secret',
            auth_token='87654321',
        )
        cls.pinned = PinnedPost.objects.create(
            user=cls.user,
            post=cls.post,
            order=0,
        )
        cls.edit_request = EditRequest.objects.create(
            user=cls.user,
            post=cls.post,
            title='Managed edit request',
            content='large-edit-request-content-secret',
        )
        cls.image_cache = ImageCache.objects.create(
            user=cls.user,
            key='managed-image-cache-secret-key'.ljust(44, 'x'),
            path='cache/managed-record.jpg',
            size=1024,
        )

    def setUp(self):
        self.telegram_admin = TelegramSyncAdmin(TelegramSync, admin.site)
        self.pinned_admin = PinnedPostAdmin(PinnedPost, admin.site)
        self.edit_request_admin = EditRequestAdmin(EditRequest, admin.site)
        self.image_cache_admin = ImageCacheAdmin(ImageCache, admin.site)

    def admin_request(self, path='/admin/'):
        request = RequestFactory().get(path)
        request.user = self.admin_user
        return request

    def test_service_owned_records_are_inspectable_without_raw_crud(self):
        request = self.admin_request()
        records = [
            (self.telegram_admin, self.telegram),
            (self.pinned_admin, self.pinned),
            (self.edit_request_admin, self.edit_request),
            (self.image_cache_admin, self.image_cache),
        ]

        for model_admin, record in records:
            with self.subTest(model=type(record).__name__):
                self.assertTrue(
                    model_admin.has_view_permission(request, record),
                )
                self.assertFalse(model_admin.has_add_permission(request))
                self.assertFalse(
                    model_admin.has_change_permission(request, record),
                )
                self.assertFalse(
                    model_admin.has_delete_permission(request, record),
                )
                self.assertNotIn(
                    'delete_selected',
                    model_admin.get_actions(request),
                )

    def test_existing_changelist_and_detail_urls_remain_viewable(self):
        self.client.force_login(self.admin_user)
        records = [
            ('board_telegramsync', self.telegram),
            ('board_pinnedpost', self.pinned),
            ('board_editrequest', self.edit_request),
            ('board_imagecache', self.image_cache),
        ]

        for url_prefix, record in records:
            with self.subTest(url_prefix=url_prefix):
                changelist = self.client.get(
                    reverse(f'admin:{url_prefix}_changelist'),
                )
                detail = self.client.get(
                    reverse(
                        f'admin:{url_prefix}_change',
                        args=[record.pk],
                    ),
                )
                self.assertEqual(changelist.status_code, 200)
                self.assertEqual(detail.status_code, 200)
                self.assertNotContains(detail, 'name="_save"')

    def test_sensitive_and_large_values_are_not_loaded_for_lists(self):
        telegram = self.telegram_admin.get_queryset(
            self.admin_request(),
        ).get(pk=self.telegram.pk)
        image_cache = self.image_cache_admin.get_queryset(
            self.admin_request(),
        ).get(pk=self.image_cache.pk)
        edit_request_request = self.admin_request()
        edit_request_request.resolver_match = SimpleNamespace(
            url_name='board_editrequest_changelist',
        )
        edit_request = self.edit_request_admin.get_queryset(
            edit_request_request,
        ).get(pk=self.edit_request.pk)

        self.assertTrue(
            {'tid', 'auth_token'}.issubset(
                telegram.get_deferred_fields(),
            ),
        )
        self.assertIn('password', telegram.user.get_deferred_fields())
        self.assertTrue(telegram.telegram_linked)
        self.assertTrue(telegram.pending_auth_token)
        self.assertIn('key', image_cache.get_deferred_fields())
        self.assertIn('content', edit_request.get_deferred_fields())

        self.client.force_login(self.admin_user)
        telegram_response = self.client.get(
            reverse(
                'admin:board_telegramsync_change',
                args=[self.telegram.pk],
            ),
        )
        image_response = self.client.get(
            reverse(
                'admin:board_imagecache_change',
                args=[self.image_cache.pk],
            ),
        )
        edit_list_response = self.client.get(
            reverse('admin:board_editrequest_changelist'),
        )
        rendered = b''.join([
            telegram_response.content,
            image_response.content,
            edit_list_response.content,
        ])

        self.telegram.refresh_from_db()
        for hidden_value in (
            self.telegram.tid,
            self.telegram.auth_token,
            self.image_cache.key,
            self.edit_request.content,
        ):
            self.assertNotIn(hidden_value.encode(), rendered)

    def test_admin_created_post_gets_required_related_records(self):
        post = Post.objects.create(
            author=self.user,
            title='Admin-created draft',
            url='admin-created-draft',
        )
        self.assertFalse(PostContent.objects.filter(post=post).exists())
        self.assertFalse(PostConfig.objects.filter(post=post).exists())

        PostAdmin(Post, admin.site).save_related(
            self.admin_request(),
            DummyPostAdminForm(post),
            [],
            change=False,
        )

        self.assertTrue(PostContent.objects.filter(post=post).exists())
        self.assertTrue(PostConfig.objects.filter(post=post).exists())
