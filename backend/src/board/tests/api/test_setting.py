import json
from datetime import datetime
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase
from django.test.client import Client
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    Comment, Config, Notify, Post, PostConfig, PostContent,
    PinnedPost, PostLikes, Profile, Series, Tag, User, UserLinkMeta,
    UsernameChangeLog,
)
from board.services.setting_post_management_service import SettingPostManagementService


class SettingTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )

        Config.objects.create(
            user=User.objects.get(username='test'),
        )

        Profile.objects.create(
            user=User.objects.get(username='test'),
            role=Profile.Role.EDITOR
        )

        for i in range(2):
            Notify.objects.create(
                user=User.objects.get(username='test'),
                content=f'test notify {i}',
                url=f'/test-url-{i}',
                key=f'test-key-{i}',
            )

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        cache.clear()

    @staticmethod
    def create_management_post(
        user,
        *,
        title,
        url,
        published_date,
        hide=False,
        series=None,
        tags=(),
        read_time=0,
        updated_date=None,
    ):
        post = Post.objects.create(
            author=user,
            title=title,
            url=url,
            published_date=published_date,
            updated_date=updated_date or timezone.now(),
            series=series,
            read_time=read_time,
        )
        PostContent.objects.create(post=post, content_html=f'<p>{title}</p>')
        PostConfig.objects.create(post=post, hide=hide)
        post.tags.add(*tags)
        return post

    def test_get_setting_notify_not_login(self):
        """비로그인 상태에서 알림 설정 조회 시 에러 테스트"""
        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_setting_notify(self):
        """알림 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['notify']), 2)
        self.assertEqual(content['body']['isTelegramSync'], False)

    def test_get_setting_pinnable_posts_supports_limit(self):
        """설정 고정 가능 포스트 목록은 limit 개수만 반환"""
        user = User.objects.get(username='test')
        posts = []
        for index in range(4):
            post = Post.objects.create(
                author=user,
                title=f'Setting Pinnable Post {index}',
                url=f'setting-pinnable-post-{index}',
                published_date=timezone.now(),
            )
            PostContent.objects.create(post=post, content_html='')
            PostConfig.objects.create(post=post)
            posts.append(post)
        PinnedPost.objects.create(user=user, post=posts[0], order=0)

        self.client.login(username='test', password='test')
        response = self.client.get('/v1/setting/pinnable-posts?limit=2')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        urls = [post['url'] for post in content['body']['posts']]
        self.assertEqual(len(urls), 2)
        self.assertNotIn('setting-pinnable-post-0', urls)
        self.assertEqual(content['body']['limit'], 2)
        self.assertEqual(content['body']['totalCount'], 3)
        self.assertEqual(content['body']['lastPage'], 2)

    def test_get_setting_pinnable_posts_supports_title_search(self):
        """설정 고정 가능 포스트 목록은 제목 검색을 지원"""
        user = User.objects.get(username='test')
        for title, url in [
            ('Needle Setting Post', 'needle-setting-post'),
            ('Regular Setting Post', 'regular-setting-post'),
        ]:
            post = Post.objects.create(
                author=user,
                title=title,
                url=url,
                published_date=timezone.now(),
            )
            PostContent.objects.create(post=post, content_html='')
            PostConfig.objects.create(post=post)

        self.client.login(username='test', password='test')
        response = self.client.get('/v1/setting/pinnable-posts?q=Needle')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        urls = [post['url'] for post in content['body']['posts']]
        self.assertEqual(urls, ['needle-setting-post'])

    def test_get_setting_pinnable_posts_supports_page(self):
        """설정 고정 가능 포스트 목록은 페이지 이동을 지원"""
        user = User.objects.get(username='test')
        for index in range(5):
            post = Post.objects.create(
                author=user,
                title=f'Setting Page Post {index}',
                url=f'setting-page-post-{index}',
                published_date=timezone.now(),
            )
            PostContent.objects.create(post=post, content_html='')
            PostConfig.objects.create(post=post)

        self.client.login(username='test', password='test')
        first_response = self.client.get('/v1/setting/pinnable-posts?limit=2&page=1')
        second_response = self.client.get('/v1/setting/pinnable-posts?limit=2&page=2')

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        first_content = json.loads(first_response.content)
        second_content = json.loads(second_response.content)
        first_urls = [post['url'] for post in first_content['body']['posts']]
        second_urls = [post['url'] for post in second_content['body']['posts']]

        self.assertEqual(second_content['body']['page'], 2)
        self.assertEqual(second_content['body']['limit'], 2)
        self.assertEqual(second_content['body']['lastPage'], 3)
        self.assertEqual(second_content['body']['totalCount'], 5)
        self.assertTrue(second_content['body']['hasPrevious'])
        self.assertTrue(second_content['body']['hasNext'])
        self.assertEqual(len(second_urls), 2)
        self.assertTrue(set(first_urls).isdisjoint(second_urls))

    def test_update_setting_notify_marks_as_read(self):
        """알림 읽음 처리 테스트"""
        notify = Notify.objects.filter(user__username='test').first()
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify',
            json.dumps({'id': notify.id}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        notify.refresh_from_db()
        self.assertTrue(notify.has_read)

    def test_update_setting_notify_rejects_other_user_notification(self):
        """다른 사용자의 알림 읽음 처리를 막는다."""
        other_user = User.objects.create_user(
            username='notify-owner',
            password='test',
            email='notify-owner@test.com',
        )
        Config.objects.create(user=other_user)
        Profile.objects.create(user=other_user, role=Profile.Role.READER)
        notify = Notify.objects.create(
            user=other_user,
            content='other notify',
            url='/other-notify',
            key='other-notify-key',
        )
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify',
            json.dumps({'id': notify.id}),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NF')
        notify.refresh_from_db()
        self.assertFalse(notify.has_read)
    
    def test_get_setting_notify_config(self):
        """알림 설정 구성 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(type(content['body']['config']), list)
        self.assertEqual(len(content['body']['config']), 4)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_get_setting_notify_config_reader(self):
        """독자(READER)는 기본 알림 설정 2개만 조회 테스트"""
        reader = User.objects.create_user(
            username='reader',
            password='test',
            email='reader@test.com',
            first_name='Reader User',
        )
        Config.objects.create(user=reader)
        Profile.objects.create(user=reader, role=Profile.Role.READER)

        self.client.login(username='reader', password='test')

        response = self.client.get('/v1/setting/notify-config')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)

        self.assertEqual(len(content['body']['config']), 2)
        self.assertEqual(
            {item['name'] for item in content['body']['config']},
            {
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
                CONFIG_TYPE.NOTIFY_MENTION.value,
            }
        )

    def test_get_setting_heatmap_counts_private_user_activity_and_uses_cache(self):
        """설정 heatmap은 기존 private activity 집계와 1시간 캐시 정책을 유지한다."""
        user = User.objects.get(username='test')
        post = Post.objects.create(
            url='heatmap-post',
            title='Heatmap Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            content_html='<h1>Heatmap</h1>'
        )
        PostConfig.objects.create(
            post=post,
            hide=True,
        )
        Comment.objects.create(
            post=post,
            author=user,
            text_md='Heatmap comment',
            text_html='<p>Heatmap comment</p>',
        )
        PostLikes.objects.create(post=post, user=user)
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/heatmap')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(sum(content['body'].values()), 3)

        other_author = User.objects.create_user(username='heatmap-other-author')
        other_post = Post.objects.create(
            url='heatmap-other-post',
            title='Heatmap Other Post',
            author=other_author,
            published_date=timezone.now(),
        )
        PostLikes.objects.create(post=other_post, user=user)
        cached_response = self.client.get('/v1/setting/heatmap')
        cached_content = json.loads(cached_response.content)

        self.assertEqual(sum(cached_content['body'].values()), 3)

    def test_get_setting_reserved_posts_returns_management_fields(self):
        """예약 포스트 설정 목록은 포스트 관리 카드에 필요한 필드를 내려준다."""
        user = User.objects.get(username='test')
        scheduled_post = Post.objects.create(
            url='scheduled-post',
            title='Scheduled Post',
            author=user,
            image='images/title/test/scheduled-post.png',
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(
            post=scheduled_post,
            content_html='<h1>Scheduled Post</h1>'
        )
        PostConfig.objects.create(
            post=scheduled_post,
            hide=False,
        )
        published_post = Post.objects.create(
            url='published-post',
            title='Published Post',
            author=user,
            published_date=timezone.now() - timezone.timedelta(days=1),
        )
        PostContent.objects.create(
            post=published_post,
            content_html='<h1>Published Post</h1>'
        )
        PostConfig.objects.create(
            post=published_post,
            hide=False,
        )
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/reserved-posts')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        post_urls = [item['url'] for item in content['body']['posts']]
        self.assertEqual(post_urls, ['scheduled-post'])
        self.assertEqual(content['body']['totalCount'], 1)
        scheduled_data = content['body']['posts'][0]
        self.assertEqual(scheduled_data['image'], 'images/title/test/scheduled-post.png')
        self.assertEqual(scheduled_data['isHide'], False)
        self.assertIn('updatedDate', scheduled_data)
        self.assertIn('readTime', scheduled_data)
        self.assertIn('countLikes', scheduled_data)
        self.assertIn('countComments', scheduled_data)
        self.assertIn('tag', scheduled_data)
        self.assertIn('series', scheduled_data)

    def test_get_setting_reserved_posts_returns_empty_page(self):
        """예약 포스트가 없어도 첫 페이지는 빈 목록으로 응답한다."""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/reserved-posts')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['posts'], [])
        self.assertEqual(content['body']['lastPage'], 1)
        self.assertEqual(content['body']['totalCount'], 0)

    def test_get_setting_posts_returns_filtered_total_count(self):
        """포스트 설정 목록은 현재 필터 결과의 전체 개수를 내려준다."""
        user = User.objects.get(username='test')
        public_post = Post.objects.create(
            url='public-post',
            title='Public Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=public_post, content_html='<p>Public</p>')
        PostConfig.objects.create(post=public_post, hide=False)

        hidden_post = Post.objects.create(
            url='hidden-post',
            title='Hidden Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=hidden_post, content_html='<p>Hidden</p>')
        PostConfig.objects.create(post=hidden_post, hide=True)
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/posts', {
            'visibility': 'public',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['totalCount'], 1)
        self.assertEqual(content['body']['posts'][0]['url'], 'public-post')

    def test_get_setting_posts_preserves_combined_filters_and_response_body(self):
        """포스트 관리 서비스 분리 후에도 필터 조합과 응답 본문을 그대로 유지한다."""
        user = User.objects.get(username='test')
        python = Tag.objects.create(value='python')
        django = Tag.objects.create(value='django')
        series = Series.objects.create(owner=user, name='Service Series', url='service-series')
        other_series = Series.objects.create(owner=user, name='Other Series', url='other-series')
        fixed_date = timezone.make_aware(datetime(2025, 1, 2, 3, 4))
        expected = self.create_management_post(
            user,
            title='Needle Hidden Post',
            url='needle-hidden-post',
            published_date=fixed_date,
            updated_date=fixed_date,
            hide=True,
            series=series,
            tags=(python,),
            read_time=1,
        )
        self.create_management_post(
            user,
            title='Needle Public Post',
            url='needle-public-post',
            published_date=fixed_date,
            series=series,
            tags=(python,),
        )
        self.create_management_post(
            user,
            title='Needle Other Tag',
            url='needle-other-tag',
            published_date=fixed_date,
            hide=True,
            series=series,
            tags=(django,),
        )
        self.create_management_post(
            user,
            title='Needle Other Series',
            url='needle-other-series',
            published_date=fixed_date,
            hide=True,
            series=other_series,
            tags=(python,),
        )
        self.create_management_post(
            user,
            title='Haystack Hidden Post',
            url='haystack-hidden-post',
            published_date=fixed_date,
            hide=True,
            series=series,
            tags=(python,),
        )
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/posts', {
            'tag': 'python',
            'series': 'service-series',
            'search': 'Needle',
            'visibility': 'hidden',
            'order': 'title',
            'page': '1',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'status': 'DONE',
            'body': {
                'username': 'test',
                'posts': [{
                    'url': expected.url,
                    'title': expected.title,
                    'image': None,
                    'createdDate': '2025-01-02',
                    'updatedDate': '2025-01-02',
                    'isHide': True,
                    'countLikes': 0,
                    'countComments': 0,
                    'readTime': 1,
                    'tag': 'python',
                    'series': 'service-series',
                }],
                'lastPage': 1,
                'totalCount': 1,
            },
        })

    def test_get_setting_post_management_rejects_legacy_invalid_queries(self):
        """포스트 관리의 잘못된 page와 order는 기존처럼 404를 반환한다."""
        self.client.login(username='test', password='test')

        for parameter in ('posts', 'reserved-posts'):
            for query in (
                {'page': 'invalid'},
                {'page': '0'},
                {'page': '2'},
                {'order': 'unknown'},
            ):
                with self.subTest(parameter=parameter, query=query):
                    response = self.client.get(f'/v1/setting/{parameter}', query)
                    self.assertEqual(response.status_code, 404)

    def test_get_setting_posts_preserves_allowed_orders(self):
        """기존 포스트 관리 정렬 필드와 내림차순 표기를 모두 허용한다."""
        user = User.objects.get(username='test')
        self.create_management_post(
            user,
            title='Allowed Order Post',
            url='allowed-order-post',
            published_date=timezone.now(),
        )
        self.client.login(username='test', password='test')

        for field in (
            'title',
            'read_time',
            'published_date',
            'updated_date',
            'count_likes',
            'count_comments',
        ):
            for order in (field, f'-{field}'):
                with self.subTest(order=order):
                    response = self.client.get('/v1/setting/posts', {'order': order})
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()['status'], 'DONE')

    def test_get_setting_tag_preserves_aggregate_response(self):
        """태그 관리 조회의 이름, count, 정렬과 응답 필드를 유지한다."""
        user = User.objects.get(username='test')
        python = Tag.objects.create(value='python')
        django = Tag.objects.create(value='django')
        first = Post.objects.create(author=user, title='Python One', url='python-one')
        second = Post.objects.create(author=user, title='Python Two', url='python-two')
        third = Post.objects.create(author=user, title='Django One', url='django-one')
        first.tags.add(python)
        second.tags.add(python)
        third.tags.add(django)
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/tag')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'status': 'DONE',
            'body': {
                'username': 'test',
                'tags': [
                    {'name': 'python', 'count': 2},
                    {'name': 'django', 'count': 1},
                ],
            },
        })

    def test_get_setting_series_preserves_aggregate_response(self):
        """시리즈 관리 조회의 순서, 게시글 수와 응답 필드를 유지한다."""
        user = User.objects.get(username='test')
        later = Series.objects.create(
            owner=user,
            name='Later Series',
            url='later-series',
            order=1,
        )
        first = Series.objects.create(
            owner=user,
            name='First Series',
            url='first-series',
            order=0,
        )
        Post.objects.create(author=user, title='First One', url='first-one', series=first)
        Post.objects.create(author=user, title='First Two', url='first-two', series=first)
        Post.objects.create(author=user, title='Later One', url='later-one', series=later)
        trashed = Post.objects.create(
            author=user,
            title='Trashed First',
            url='trashed-first',
            series=first,
        )
        Post.objects.filter(pk=trashed.pk).update(deleted_date=timezone.now())
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/series')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'status': 'DONE',
            'body': {
                'username': 'test',
                'series': [
                    {
                        'id': first.id,
                        'url': 'first-series',
                        'title': 'First Series',
                        'totalPosts': 2,
                    },
                    {
                        'id': later.id,
                        'url': 'later-series',
                        'title': 'Later Series',
                        'totalPosts': 1,
                    },
                ],
            },
        })

    def test_get_setting_post_management_query_budget(self):
        """서비스 분리 후 posts/tag/series 관리 조회의 쿼리 수가 증가하지 않는다."""
        user = User.objects.get(username='test')
        tag = Tag.objects.create(value='query-budget')
        series = Series.objects.create(owner=user, name='Query Budget', url='query-budget')
        self.create_management_post(
            user,
            title='Query Budget Post',
            url='query-budget-post',
            published_date=timezone.now(),
            series=series,
            tags=(tag,),
        )
        self.client.login(username='test', password='test')

        with CaptureQueriesContext(connection) as post_queries:
            posts_response = self.client.get('/v1/setting/posts')
        with CaptureQueriesContext(connection) as tag_queries:
            tag_response = self.client.get('/v1/setting/tag')
        with CaptureQueriesContext(connection) as series_queries:
            series_response = self.client.get('/v1/setting/series')

        self.assertEqual(posts_response.status_code, 200)
        self.assertEqual(tag_response.status_code, 200)
        self.assertEqual(series_response.status_code, 200)
        self.assertLessEqual(len(post_queries), 9)
        self.assertLessEqual(len(tag_queries), 6)
        self.assertLessEqual(len(series_queries), 6)

        with CaptureQueriesContext(connection) as service_queries:
            list(SettingPostManagementService.get_post_management_queryset(user))
        self.assertEqual(len(service_queries), 2)
        post_sql = service_queries[0]['sql'].lower()
        self.assertNotIn('left outer join "board_postlikes"', post_sql)
        self.assertNotIn('left outer join "board_comment"', post_sql)

    def test_get_setting_reserved_posts_orders_by_count_fields(self):
        """예약 포스트 설정 목록은 좋아요/댓글 수 정렬을 지원한다."""
        user = User.objects.get(username='test')
        liker = User.objects.create_user(
            username='setting-liker',
            password='test',
            email='setting-liker@test.com',
        )
        Config.objects.create(user=liker)
        Profile.objects.create(user=liker, role=Profile.Role.READER)

        quiet_post = Post.objects.create(
            url='quiet-scheduled-post',
            title='Quiet Scheduled Post',
            author=user,
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=quiet_post, content_html='<p>Quiet</p>')
        PostConfig.objects.create(post=quiet_post, hide=False)

        active_post = Post.objects.create(
            url='active-scheduled-post',
            title='Active Scheduled Post',
            author=user,
            published_date=timezone.now() + timezone.timedelta(days=2),
        )
        PostContent.objects.create(post=active_post, content_html='<p>Active</p>')
        PostConfig.objects.create(post=active_post, hide=False)
        PostLikes.objects.create(post=active_post, user=liker)
        Comment.objects.create(
            post=active_post,
            author=liker,
            text_md='Scheduled comment',
            text_html='<p>Scheduled comment</p>',
        )
        self.client.login(username='test', password='test')

        likes_response = self.client.get('/v1/setting/reserved-posts', {
            'order': '-count_likes',
        })
        comments_response = self.client.get('/v1/setting/reserved-posts', {
            'order': '-count_comments',
        })

        self.assertEqual(likes_response.status_code, 200)
        self.assertEqual(comments_response.status_code, 200)
        likes_content = json.loads(likes_response.content)
        comments_content = json.loads(comments_response.content)
        self.assertEqual(likes_content['body']['posts'][0]['url'], 'active-scheduled-post')
        self.assertEqual(comments_content['body']['posts'][0]['url'], 'active-scheduled-post')

    def test_update_notify_config_without_posts(self):
        """포스트가 없는 사용자의 알림 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'false',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(username='test')
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), False)

    def test_update_notify_config_with_posts(self):
        """포스트가 있는 사용자의 알림 설정 업데이트 테스트"""
        user = User.objects.get(username='test')
        
        post = Post.objects.create(
            url='test-post',
            title='Test Post',
            author=user,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=post,
            content_html='<h1>Test</h1>'
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/notify-config',
            json.dumps({
                CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: 'true',
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: 'true',
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: 'false',
                CONFIG_TYPE.NOTIFY_MENTION.value: 'true',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user.refresh_from_db()
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT), True)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE), False)
        self.assertEqual(user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION), True)
    
    def test_get_setting_account(self):
        """계정 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/account')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['username'], 'test')
        self.assertEqual(content['body']['name'], 'Test User')

    def test_update_username(self):
        """사용자 필명 변경 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=newtest',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        user = User.objects.get(id=User.objects.get(username='newtest').id)
        self.assertEqual(user.username, 'newtest')
        self.assertTrue(
            UsernameChangeLog.objects.filter(
                user=user,
                username='test',
            ).exists()
        )

    def test_update_username_duplicate(self):
        """중복된 사용자 필명 변경 테스트"""
        User.objects.create_user(
            username='duplicate',
            password='test',
            email='duplicate@test.com',
            first_name='Duplicate User',
        )

        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=duplicate',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorMessage'], '이미 사용중인 아이디입니다.')

    def test_update_username_preserves_six_month_restriction(self):
        """게시글 작성자의 6개월 username 변경 제한과 오류 계약을 유지한다."""
        user = User.objects.get(username='test')
        Post.objects.create(author=user, title='Restriction Post', url='restriction-post')
        UsernameChangeLog.objects.create(user=user, username='previous-test')
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            'username=restricted',
            content_type='application/x-www-form-urlencoded',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'status': 'ERROR',
            'errorCode': 'error:VA',
            'errorMessage': (
                '작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.'
            ),
        })
        user.refresh_from_db()
        self.assertEqual(user.username, 'test')

    def test_update_account_preserves_password_validation_priority(self):
        """비밀번호 검증 순서와 한국어 오류 메시지를 그대로 유지한다."""
        self.client.login(username='test', password='test')
        cases = (
            ('Aa1!aaa', '비밀번호는 8자 이상이어야 합니다.'),
            ('Abcdefg!', '비밀번호는 숫자를 포함해야 합니다.'),
            ('ABCDEFG1!', '비밀번호는 소문자를 포함해야 합니다.'),
            ('abcdefg1!', '비밀번호는 대문자를 포함해야 합니다.'),
            ('Abcdefg1', '비밀번호는 특수문자를 포함해야 합니다.'),
        )

        for password, message in cases:
            with self.subTest(password=password):
                response = self.client.put(
                    '/v1/setting/account',
                    json.dumps({'password': password}),
                    content_type='application/json',
                )
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), {
                    'status': 'ERROR',
                    'errorCode': 'error:VA',
                    'errorMessage': message,
                })

    def test_update_password_keeps_authenticated_session(self):
        """비밀번호 변경 성공 후 새 hash를 저장하고 현재 세션 로그인을 유지한다."""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            json.dumps({'password': 'Strong123!'}),
            content_type='application/json',
        )
        authenticated_response = self.client.get('/v1/setting/account')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'DONE', 'body': {}})
        self.assertEqual(authenticated_response.status_code, 200)
        self.assertEqual(authenticated_response.json()['status'], 'DONE')
        user = User.objects.get(username='test')
        self.assertTrue(user.check_password('Strong123!'))

    def test_update_account_preserves_existing_partial_save_characteristic(self):
        """username 선행 저장 뒤 비밀번호 오류 시 기존 부분 저장 특성을 바꾸지 않는다."""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/account',
            json.dumps({
                'username': 'partialsave',
                'name': 'Unsaved Name',
                'password': 'short',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'status': 'ERROR',
            'errorCode': 'error:VA',
            'errorMessage': '비밀번호는 8자 이상이어야 합니다.',
        })
        user = User.objects.get(username='partialsave')
        self.assertEqual(user.first_name, 'Test User')
        self.assertTrue(
            UsernameChangeLog.objects.filter(user=user, username='test').exists()
        )

    def test_upload_avatar(self):
        """프로필 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (100, 100), color='red')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'test.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/avatar',
            {'avatar': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_upload_avatar_save_failure_keeps_existing_database_value(self):
        """avatar 저장 실패는 기존 DB 경로를 바꾸거나 성공 응답으로 숨기지 않는다."""
        user = User.objects.get(username='test')
        profile = Profile.objects.get(user=user)
        Profile.objects.filter(pk=profile.pk).update(avatar='images/avatar/test/old.png')
        self.client.login(username='test', password='test')
        uploaded = SimpleUploadedFile('new.png', b'new-avatar', content_type='image/png')

        with self.settings(DEBUG_PROPAGATE_EXCEPTIONS=True), patch.object(
            Profile,
            'save',
            side_effect=OSError('avatar save failed'),
        ):
            with self.assertRaisesMessage(OSError, 'avatar save failed'):
                self.client.post('/v1/setting/avatar', {'avatar': uploaded})

        profile.refresh_from_db()
        self.assertEqual(profile.avatar.name, 'images/avatar/test/old.png')

    def test_upload_cover(self):
        """커버 이미지 업로드 테스트"""
        from io import BytesIO
        from PIL import Image

        self.client.login(username='test', password='test')

        image = Image.new('RGB', (1200, 514), color='blue')
        image_file = BytesIO()
        image.save(image_file, 'PNG')
        image_file.name = 'cover.png'
        image_file.seek(0)

        response = self.client.post(
            '/v1/setting/cover',
            {'cover': image_file},
            format='multipart'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

    def test_delete_cover(self):
        """커버 이미지 삭제 테스트"""
        user = User.objects.get(username='test')
        profile = Profile.objects.get(user=user)
        profile.cover = 'images/avatar/test/cover.png'
        profile.save(update_fields=['cover'])

        self.client.login(username='test', password='test')

        response = self.client.delete('/v1/setting/cover')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIsNone(content['body']['url'])

        profile.refresh_from_db()
        self.assertFalse(profile.cover)

    def test_delete_cover_storage_failure_keeps_existing_database_value(self):
        """cover storage 삭제 실패 시 DB 경로 저장을 진행하지 않는다."""
        user = User.objects.get(username='test')
        profile = Profile.objects.get(user=user)
        Profile.objects.filter(pk=profile.pk).update(cover='images/avatar/test/cover.png')
        storage = Profile._meta.get_field('cover').storage
        self.client.login(username='test', password='test')

        with self.settings(DEBUG_PROPAGATE_EXCEPTIONS=True), patch.object(
            storage,
            'delete',
            side_effect=OSError('cover delete failed'),
        ):
            with self.assertRaisesMessage(OSError, 'cover delete failed'):
                self.client.delete('/v1/setting/cover')

        profile.refresh_from_db()
        self.assertEqual(profile.cover.name, 'images/avatar/test/cover.png')

    def test_get_setting_profile(self):
        """프로필 설정 조회 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/setting/profile')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('avatar', content['body'])
        self.assertIn('cover', content['body'])
        self.assertIn('bio', content['body'])
        self.assertIn('homepage', content['body'])

    def test_update_profile(self):
        """프로필 설정 업데이트 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/profile',
            'bio=Test bio&homepage=https://example.com',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        profile = Profile.objects.get(user=User.objects.get(username='test'))
        self.assertEqual(profile.bio, 'Test bio')
        self.assertEqual(profile.homepage, 'https://example.com')

    def test_update_profile_preserves_json_fallback_and_missing_field_reset(self):
        """JSON profile 변경과 누락 필드를 빈 문자열로 초기화하는 기존 동작을 유지한다."""
        user = User.objects.get(username='test')
        Profile.objects.filter(user=user).update(
            bio='Old bio',
            homepage='https://old.example.com',
        )
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/profile',
            json.dumps({'bio': 'JSON bio'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'DONE', 'body': {}})
        profile = Profile.objects.get(user=user)
        self.assertEqual(profile.bio, 'JSON bio')
        self.assertEqual(profile.homepage, '')

    def test_update_social_links(self):
        """소셜 링크 생성/수정/삭제 테스트"""
        user = User.objects.get(username='test')
        update_link = UserLinkMeta.objects.create(
            user=user,
            name='github',
            value='https://github.com/old',
            order=1,
        )
        delete_link = UserLinkMeta.objects.create(
            user=user,
            name='old',
            value='https://old.example.com',
            order=2,
        )
        self.client.login(username='test', password='test')

        response = self.client.put(
            '/v1/setting/social',
            json.dumps({
                'update': f'{update_link.id},github,https://github.com/new,3',
                'create': 'homepage,https://example.com,4',
                'delete': str(delete_link.id),
            }),
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        update_link.refresh_from_db()
        self.assertEqual(update_link.value, 'https://github.com/new')
        self.assertFalse(UserLinkMeta.objects.filter(id=delete_link.id).exists())
        self.assertEqual(
            [item['name'] for item in content['body']],
            ['github', 'homepage'],
        )

    def test_update_account_not_logged_in(self):
        """비로그인 상태에서 계정 수정 시도"""
        response = self.client.put(
            '/v1/setting/account',
            'username=hacked',
            content_type='application/x-www-form-urlencoded'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')
