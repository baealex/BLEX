from datetime import timedelta

from django.contrib import admin
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import RequestFactory, TestCase
from django.test.utils import CaptureQueriesContext
from django.urls import resolve, reverse
from django.utils import timezone

from board.admin.comment import CommentAdmin
from board.admin.image import ImageCacheAdmin
from board.admin.post import EditRequestAdmin, PinnedPostAdmin, PostAdmin
from board.admin.series import SeriesAdmin, SeriesPostInline
from board.admin.tag import TagAdmin
from board.admin.user import ConfigAdmin
from board.models import (
    Comment,
    Config,
    EditHistory,
    EditRequest,
    EmailChange,
    Form,
    ImageCache,
    Notify,
    Post,
    PostConfig,
    PostContent,
    PostLikes,
    PinnedPost,
    Profile,
    Series,
    SiteBanner,
    SiteNotice,
    SocialAuth,
    Tag,
    TelegramSync,
    TwoFactorAuth,
    UserConfigMeta,
    UserLinkMeta,
    UsernameChangeLog,
)


class AdminListPerformanceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin_user = User.objects.create_superuser(
            username='list-performance-admin',
            email='list-performance-admin@example.com',
            password='test',
        )
        cls.authors = [
            User.objects.create_user(
                username=f'list-author-{index}',
                password='test',
            )
            for index in range(4)
        ]
        cls.configs = [
            Config.objects.create(user=author)
            for author in cls.authors
        ]
        TelegramSync.objects.bulk_create([
            TelegramSync(
                user=author,
                tid=f'encrypted-telegram-{index}',
            )
            for index, author in enumerate(cls.authors)
        ])
        TwoFactorAuth.objects.bulk_create([
            TwoFactorAuth(
                user=author,
                recovery_key=f'encrypted-recovery-{index}',
                totp_secret=f'encrypted-totp-{index}',
            )
            for index, author in enumerate(cls.authors)
        ])

        cls.series = []
        cls.tags = []
        cls.public_posts = []
        for index, author in enumerate(cls.authors):
            series = Series.objects.create(
                owner=author,
                name=f'List series {index}',
                url=f'list-series-{index}',
            )
            tag = Tag.objects.create(value=f'list-tag-{index}')
            public_post = cls.create_post(
                author=author,
                series=series,
                tag=tag,
                suffix=f'public-{index}',
                published_date=timezone.now() - timedelta(days=1),
                image=True,
            )
            cls.create_post(
                author=author,
                series=series,
                tag=tag,
                suffix=f'draft-{index}',
                published_date=None,
            )
            cls.series.append(series)
            cls.tags.append(tag)
            cls.public_posts.append(public_post)

        cls.trashed_post = cls.create_post(
            author=cls.authors[0],
            series=cls.series[0],
            tag=cls.tags[0],
            suffix='trashed',
            published_date=timezone.now() - timedelta(days=2),
            deleted=True,
            image=True,
        )
        cls.trash_only_tag = Tag.objects.create(value='trash-only-tag')
        cls.trashed_post.tags.add(cls.trash_only_tag)
        cls.active_comment = Comment.objects.create(
            author=cls.authors[0],
            post=cls.public_posts[0],
            text_md='Active comment',
            text_html='<p>Active comment</p>',
        )
        cls.deleted_comment = Comment.objects.create(
            author=None,
            post=cls.public_posts[0],
            text_md='Deleted comment',
            text_html='<p>Deleted comment</p>',
        )
        cls.active_comment.likes.add(cls.authors[1])
        PostLikes.objects.create(
            post=cls.public_posts[0],
            user=cls.authors[1],
        )
        for index, post in enumerate(cls.public_posts):
            EditRequest.objects.create(
                user=cls.authors[index],
                post=post,
                title=f'List edit request {index}',
            )
            PinnedPost.objects.create(
                user=cls.authors[index],
                post=post,
                order=0,
            )
        ImageCache.objects.create(
            user=cls.authors[0],
            key='a' * 44,
            path='cache/list-preview.jpg',
            size=1024,
        )
        cls.profile = Profile.objects.create(
            user=cls.authors[0],
            bio='large profile bio ' * 100,
            about_md='large profile markdown ' * 500,
            about_html='<p>' + ('large profile html ' * 500) + '</p>',
        )
        cls.form = Form.objects.create(
            user=cls.authors[0],
            title='List form',
            content='large form content ' * 500,
        )
        cls.notification = Notify.objects.create(
            user=cls.authors[0],
            key='n' * 44,
            url='/list-notification',
            content='List notification content',
        )
        cls.revision = EditHistory.objects.create(
            post=cls.public_posts[0],
            actor=cls.authors[0],
            title='List revision',
            subtitle='List revision subtitle',
            content='large revision content ' * 500,
            content_excerpt='List revision excerpt',
            description='List revision description',
            tags=['list-tag'],
        )
        cls.site_notices = [
            SiteNotice.objects.create(
                scope='global',
                user=None,
                title='Global list notice',
            ),
            SiteNotice.objects.create(
                scope='user',
                user=cls.authors[0],
                title='User list notice',
            ),
        ]
        cls.site_banners = [
            SiteBanner.objects.create(
                scope='global',
                user=None,
                title='Global list banner',
                content_html='<p>' + ('large banner html ' * 500) + '</p>',
            ),
            SiteBanner.objects.create(
                scope='user',
                user=cls.authors[0],
                title='User list banner',
                content_html='<p>User banner</p>',
            ),
        ]
        UserConfigMeta.objects.create(
            user=cls.authors[0],
            name='list-setting',
            value='true',
        )
        UserLinkMeta.objects.create(
            user=cls.authors[0],
            name='homepage',
            value='https://example.com',
        )
        UsernameChangeLog.objects.create(
            user=cls.authors[0],
            username='previous-list-author',
        )
        cls.log_entry = LogEntry.objects.create(
            user=cls.admin_user,
            content_type=ContentType.objects.get_for_model(Post),
            object_id=str(cls.public_posts[0].pk),
            object_repr=str(cls.public_posts[0]),
            action_flag=CHANGE,
            change_message='large Admin change message ' * 100,
        )
        Series.objects.filter(pk=cls.series[0].pk).update(
            text_md='large series markdown ' * 500,
            text_html='<p>' + ('large series html ' * 500) + '</p>',
        )

    @classmethod
    def create_post(
        cls,
        *,
        author: User,
        series: Series,
        tag: Tag,
        suffix: str,
        published_date,
        deleted: bool = False,
        image: bool = False,
    ) -> Post:
        post = Post.objects.create(
            author=author,
            series=series,
            title=f'List post {suffix}',
            url=f'list-post-{suffix}',
            published_date=published_date,
        )
        PostConfig.objects.create(post=post, hide=False)
        PostContent.objects.create(
            post=post,
            content_html='<p>' + ('large admin body ' * 500) + '</p>',
        )
        post.tags.add(tag)
        updates = {}
        if deleted:
            updates['deleted_date'] = timezone.now()
        if image:
            updates['image'] = f'images/title/{suffix}.jpg'
        if updates:
            Post.all_objects.filter(pk=post.pk).update(**updates)
        return post

    def setUp(self):
        request = RequestFactory().get('/admin/')
        request.user = self.admin_user
        self.request = request
        self.post_admin = PostAdmin(Post, admin.site)
        self.comment_admin = CommentAdmin(Comment, admin.site)
        self.tag_admin = TagAdmin(Tag, admin.site)
        self.series_admin = SeriesAdmin(Series, admin.site)
        self.config_admin = ConfigAdmin(Config, admin.site)

    @staticmethod
    def admin_url_name(model, view_name: str) -> str:
        opts = model._meta
        return (
            f'admin:{opts.app_label}_{opts.model_name}_{view_name}'
        )

    def changelist_request(self, model):
        path = reverse(self.admin_url_name(model, 'changelist'))
        request = RequestFactory().get(path)
        request.user = self.admin_user
        request.resolver_match = resolve(path)
        return request

    def change_request(self, model, object_id: int):
        path = reverse(
            self.admin_url_name(model, 'change'),
            args=[object_id],
        )
        request = RequestFactory().get(path)
        request.user = self.admin_user
        request.resolver_match = resolve(path)
        return request

    def large_field_cases(self):
        return (
            (Comment, self.active_comment.pk, {'text_md'}),
            (Notify, self.notification.pk, {'key'}),
            (
                EditHistory,
                self.revision.pk,
                {'content', 'description', 'tags', 'subtitle'},
            ),
            (Form, self.form.pk, {'content'}),
            (Series, self.series[0].pk, {'text_md', 'text_html'}),
            (SiteBanner, self.site_banners[0].pk, {'content_html'}),
            (
                Profile,
                self.profile.pk,
                {'bio', 'about_md', 'about_html'},
            ),
            (User, self.authors[0].pk, {'password'}),
            (LogEntry, self.log_entry.pk, {'change_message'}),
        )

    def test_post_list_loads_only_display_relations_in_two_queries(self):
        with CaptureQueriesContext(connection) as queries:
            posts = list(
                self.post_admin.get_queryset(self.request).order_by('pk'),
            )
            for post in posts:
                self.post_admin.thumbnail_preview(post)
                self.post_admin.author_link(post)
                self.post_admin.series_link(post)
                self.post_admin.tags_preview(post)
                self.post_admin.likes_count(post)
                self.post_admin.comments_count(post)
                self.post_admin.status_badges(post)
                self.post_admin.total_likes(post)
                self.post_admin.total_comments(post)

        self.assertEqual(len(queries), 2)
        post_query = queries.captured_queries[0]['sql'].lower()
        self.assertNotIn('board_postcontent', post_query)
        self.assertNotIn('password', post_query)
        rendered_comments = str(
            self.post_admin.comments_count(
                next(post for post in posts if post.pk == self.public_posts[0].pk),
            ),
        )
        self.assertIn('1', rendered_comments)
        self.assertIn('삭제 1', rendered_comments)

    def test_post_relation_lists_select_displayed_objects_once(self):
        edit_request_admin = EditRequestAdmin(EditRequest, admin.site)
        pinned_post_admin = PinnedPostAdmin(PinnedPost, admin.site)

        with CaptureQueriesContext(connection) as edit_queries:
            edit_requests = list(
                edit_request_admin.get_queryset(self.request).order_by('pk'),
            )
            for edit_request in edit_requests:
                str(edit_request.post)

        with CaptureQueriesContext(connection) as pinned_queries:
            pinned_posts = list(
                pinned_post_admin.get_queryset(self.request).order_by('pk'),
            )
            for pinned_post in pinned_posts:
                str(pinned_post.post)
                str(pinned_post.user)

        self.assertEqual(len(edit_queries), 1)
        self.assertEqual(len(pinned_queries), 1)
        self.assertNotIn(
            'password',
            pinned_queries.captured_queries[0]['sql'].lower(),
        )

    def test_comment_list_uses_annotated_like_counts_without_prefetch(self):
        with CaptureQueriesContext(connection) as queries:
            comments = list(
                self.comment_admin.get_queryset(self.request).order_by('pk'),
            )
            for comment in comments:
                self.comment_admin.content_preview(comment)
                self.comment_admin.post_link(comment)
                self.comment_admin.author_link(comment)
                self.comment_admin.likes_display(comment)
                self.comment_admin.likes_count(comment)

        self.assertEqual(len(queries), 1)
        active = next(
            comment
            for comment in comments
            if comment.pk == self.active_comment.pk
        )
        self.assertEqual(active.likes_count_annotated, 1)

    def test_tag_list_annotates_clear_post_states_and_image_presence(self):
        with CaptureQueriesContext(connection) as queries:
            tags = list(
                self.tag_admin.get_queryset(self.request).order_by('pk'),
            )
            for tag in tags:
                self.tag_admin.count(tag)
                self.tag_admin.public_count(tag)
                self.tag_admin.trash_count(tag)
                self.tag_admin.has_image(tag)
                self.tag_admin.usage_status(tag)

        self.assertEqual(len(queries), 1)
        target = next(tag for tag in tags if tag.pk == self.tags[0].pk)
        self.assertEqual(target.post_count, 2)
        self.assertEqual(target.public_post_count, 1)
        self.assertEqual(target.trashed_post_count, 1)
        self.assertTrue(target.has_public_image)
        trash_only = next(
            tag for tag in tags if tag.pk == self.trash_only_tag.pk
        )
        self.assertEqual(trash_only.post_count, 0)
        self.assertEqual(trash_only.trashed_post_count, 1)
        self.assertIn(
            '휴지통 전용',
            str(self.tag_admin.usage_status(trash_only)),
        )

    def test_series_list_and_inline_avoid_per_row_post_queries(self):
        with CaptureQueriesContext(connection) as queries:
            series_rows = list(
                self.series_admin.get_queryset(self.request).order_by('pk'),
            )
            for series in series_rows:
                self.series_admin.owner_link(series)
                self.series_admin.count_posts(series)
                self.series_admin.public_posts(series)
                self.series_admin.trashed_posts(series)
                self.series_admin.thumbnail_preview(series)
                self.series_admin.posts_summary(series)

        self.assertEqual(len(queries), 1)
        target = next(
            series
            for series in series_rows
            if series.pk == self.series[0].pk
        )
        self.assertEqual(target.count_posts, 2)
        self.assertEqual(target.public_post_count, 1)
        self.assertEqual(target.trashed_post_count, 1)

        inline = SeriesPostInline(Series, admin.site)
        with CaptureQueriesContext(connection) as inline_queries:
            posts = list(
                inline.get_queryset(self.request)
                .filter(series=self.series[0])
                .order_by('pk'),
            )
            for post in posts:
                inline.config_hide(post)
                inline.view_link(post)

        self.assertEqual(len(inline_queries), 1)

    def test_config_list_checks_integrations_without_loading_secrets(self):
        with CaptureQueriesContext(connection) as queries:
            configs = list(
                self.config_admin.get_queryset(self.request).order_by('pk'),
            )
            for config in configs:
                self.config_admin.user_link(config)
                self.config_admin.telegram_status(config)
                self.config_admin.two_factor_status(config)

        self.assertEqual(len(queries), 1)
        config_query = queries.captured_queries[0]['sql'].lower()
        self.assertNotIn('password', config_query)
        self.assertNotIn('totp_secret', config_query)
        self.assertNotIn('recovery_key', config_query)
        self.assertNotIn('auth_token', config_query)
        self.assertTrue(configs[0].telegram_linked)
        self.assertTrue(configs[0].two_factor_enabled)

    def test_high_growth_changelists_do_not_run_unfiltered_counts(self):
        self.client.force_login(self.admin_user)

        for model in (Post, Comment, Notify, EditHistory, LogEntry):
            url_name = self.admin_url_name(model, 'changelist')
            with self.subTest(model=model):
                response = self.client.get(reverse(url_name), {'q': 'list'})
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.context['cl'].full_result_count)

    def test_changelists_defer_unused_large_fields(self):
        for model, object_id, expected_fields in self.large_field_cases():
            with self.subTest(model=model):
                model_admin = admin.site._registry[model]
                row = model_admin.get_queryset(
                    self.changelist_request(model),
                ).get(pk=object_id)
                self.assertTrue(
                    expected_fields.issubset(row.get_deferred_fields()),
                )

    def test_change_views_keep_fields_needed_for_inspection_and_editing(self):
        for model, object_id, expected_fields in self.large_field_cases():
            with self.subTest(model=model):
                model_admin = admin.site._registry[model]
                row = model_admin.get_queryset(
                    self.change_request(model, object_id),
                ).get(pk=object_id)
                self.assertTrue(
                    expected_fields.isdisjoint(row.get_deferred_fields()),
                )

    def test_user_related_changelists_do_not_select_password_hashes(self):
        models = (
            EmailChange, UsernameChangeLog, User, UserConfigMeta,
            UserLinkMeta, Profile, Comment, Notify, Form, Series,
            SiteNotice, SiteBanner, TwoFactorAuth, SocialAuth, LogEntry,
        )

        for model in models:
            with self.subTest(model=model):
                model_admin = admin.site._registry[model]
                queryset = model_admin.get_queryset(
                    self.changelist_request(model),
                )
                self.assertNotIn('password', str(queryset.query).lower())

        social_auth_query = admin.site._registry[SocialAuth].get_queryset(
            self.changelist_request(SocialAuth),
        )
        social_auth_sql = str(social_auth_query.query).lower()
        self.assertNotIn('client_id', social_auth_sql)
        self.assertNotIn('client_secret', social_auth_sql)

    def test_nullable_user_lists_select_displayed_users_once(self):
        for model in (SiteNotice, SiteBanner):
            with self.subTest(model=model):
                model_admin = admin.site._registry[model]
                with CaptureQueriesContext(connection) as queries:
                    rows = list(
                        model_admin.get_queryset(
                            self.changelist_request(model),
                        ),
                    )
                    for row in rows:
                        if row.user is not None:
                            str(row.user)

                self.assertEqual(len(queries), 1)
                self.assertNotIn(
                    'password',
                    queries.captured_queries[0]['sql'].lower(),
                )

    def test_image_cache_list_uses_compact_lazy_previews(self):
        model_admin = ImageCacheAdmin(ImageCache, admin.site)

        image_preview = str(model_admin.image(ImageCache(path='cache.jpg')))
        video_preview = str(model_admin.image(ImageCache(path='cache.mp4')))

        self.assertEqual(model_admin.list_per_page, 30)
        self.assertIn('max-width: 120px', image_preview)
        self.assertIn('loading="lazy"', image_preview)
        self.assertNotIn('480px', image_preview)
        self.assertIn('max-width: 120px', video_preview)
        self.assertIn('preload="none"', video_preview)

    def test_optimized_admin_changelists_render_successfully(self):
        self.client.force_login(self.admin_user)

        for url_name in (
            'admin:board_post_changelist',
            'admin:board_comment_changelist',
            'admin:board_tag_changelist',
            'admin:board_series_changelist',
            'admin:board_config_changelist',
            'admin:board_imagecache_changelist',
        ):
            with self.subTest(url_name=url_name):
                response = self.client.get(reverse(url_name))
                self.assertEqual(response.status_code, 200)
