import json
import datetime
from io import BytesIO
from unittest.mock import patch

from PIL import Image

from django.test import Client, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext

from board.models import (
    User, Config, Post, PostContent, PostConfig, Profile, Series, Tag
)
from board.modules.time import time_since


class PostTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        author = User.objects.create_user(
            username='author',
            password='author',
            email='author@author.com',
            first_name='Author User',
        )
        Profile.objects.create(user=author, role=Profile.Role.EDITOR)
        Config.objects.create(user=author)

        viewer = User.objects.create_user(
            username='viewer',
            password='viewer',
            email='viewer@author.com',
            first_name='Viewer User',
        )
        Profile.objects.create(user=viewer, role=Profile.Role.READER)
        Config.objects.create(user=viewer)

        number_of_posts = 100

        for post_num in range(number_of_posts):
            post = Post.objects.create(
                url=f'test-post-{post_num}',
                title=f'Test Post {post_num}',
                author=author,
                published_date=timezone.now(),
            )
            PostContent.objects.create(
                post=post,
                content_html=f'<h1>Test Post {post_num}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
    
    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def _create_scheduled_post(
        self,
        url: str,
        *,
        hide: bool = False,
        advertise: bool = False,
    ) -> Post:
        post = Post.objects.create(
            url=url,
            title='Scheduled Lifecycle Post',
            author=User.objects.get(username='author'),
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(
            post=post,
            content_html='<p>Scheduled lifecycle body</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=advertise,
        )
        return post


    def test_get_user_post_detail(self):
        """포스트 상세 조회 테스트"""
        params = {'mode': 'view'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)

    def test_no_access_other_user_post_edit_mode(self):
        """다른 사용자의 포스트 편집 모드 접근 차단 테스트"""
        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode(self):
        """포스트 편집 모드 조회 테스트"""
        self.client.login(username='author', password='author')
        post = Post.objects.get(url='test-post-1')
        post.config.block_comment = True
        post.config.save(update_fields=['block_comment'])

        params = {'mode': 'edit'}
        response = self.client.get('/v1/users/@author/posts/test-post-1', params)
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertTrue(content['body']['blockComment'])
        self.assertEqual(
            content['body']['updatedDate'],
            post.updated_date.isoformat(),
        )

    def test_get_user_post_edit_mode_skips_engagement_aggregations(self):
        self.client.login(username='author', password='author')

        with CaptureQueriesContext(connection) as captured:
            response = self.client.get(
                '/v1/users/@author/posts/test-post-1',
                {'mode': 'edit'},
            )

        sql = '\n'.join(query['sql'] for query in captured.captured_queries)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('JOIN "board_post_likes"', sql)
        self.assertNotIn('JOIN "board_comment"', sql)

    def test_get_user_post_detail_edit_mode_includes_schedule_fields(self):
        """예약 포스트 편집 데이터는 예약 여부와 발행 예정 시각을 포함한다."""
        post = Post.objects.create(
            url='scheduled-edit-fields',
            title='Scheduled Edit Fields',
            author=User.objects.get(username='author'),
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=post, content_html='<p>Scheduled</p>')
        PostConfig.objects.create(post=post, hide=False, advertise=False)
        self.client.login(username='author', password='author')

        response = self.client.get('/v1/users/@author/posts/scheduled-edit-fields', {
            'mode': 'edit',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertTrue(content['body']['isScheduled'])
        self.assertIsNotNone(content['body']['publishedDate'])

    def test_update_user_post(self):
        """포스트 수정 테스트"""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-1')
        post.config.block_comment = True
        post.config.save(update_fields=['block_comment'])
        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': f'{post.title} Updated',
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
        })

        post.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.title, 'Test Post 1 Updated')
        post.config.refresh_from_db()
        self.assertTrue(post.config.block_comment)

        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': post.title,
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'block_comment': 'false',
        })
        self.assertEqual(response.status_code, 200)
        post.config.refresh_from_db()
        self.assertFalse(post.config.block_comment)

    def test_update_user_post_noop_preserves_updated_date(self):
        """동일한 수정 요청은 발행 글의 수정 시각을 바꾸지 않는다."""
        self.client.login(username='author', password='author')
        post = Post.objects.get(url='test-post-1')
        tag = Tag.objects.create(value='unchanged')
        post.tags.add(tag)
        previous_updated_date = post.updated_date

        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': post.title,
            'subtitle': post.subtitle,
            'text_html': post.content.content_html,
            'description': post.meta_description,
            'series': '',
            'tag': tag.value,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'block_comment': str(post.config.block_comment).lower(),
            'cover_layout': post.config.cover_layout,
            'cover_image_position': post.config.cover_image_position,
            'cover_image_ratio': post.config.cover_image_ratio,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content)['status'], 'DONE')
        post.refresh_from_db()
        self.assertEqual(post.updated_date, previous_updated_date)
        self.assertEqual(post.tagging(), ['unchanged'])

    def test_update_user_post_change_advances_updated_date(self):
        """실제 변경이 있는 수정 요청만 발행 글의 수정 시각을 갱신한다."""
        self.client.login(username='author', password='author')
        post = Post.objects.get(url='test-post-1')
        tag = Tag.objects.create(value='changed-contract')
        post.tags.add(tag)
        next_updated_date = post.updated_date + timezone.timedelta(hours=1)

        with patch(
            'board.services.post_service.timezone.now',
            return_value=next_updated_date,
        ):
            response = self.client.post('/v1/users/@author/posts/test-post-1', {
                'title': 'Actually Updated Title',
                'subtitle': post.subtitle,
                'text_html': post.content.content_html,
                'description': post.meta_description,
                'series': '',
                'tag': tag.value,
                'is_hide': post.config.hide,
                'is_advertise': post.config.advertise,
                'block_comment': str(post.config.block_comment).lower(),
                'cover_layout': post.config.cover_layout,
                'cover_image_position': post.config.cover_image_position,
                'cover_image_ratio': post.config.cover_image_ratio,
            })

        self.assertEqual(response.status_code, 200)
        post.refresh_from_db()
        self.assertEqual(post.title, 'Actually Updated Title')
        self.assertEqual(post.updated_date, next_updated_date)

    def test_update_scheduled_post_reserved_date(self):
        """예약 포스트 수정 API는 예약 시간을 변경할 수 있다."""
        author = User.objects.get(username='author')
        scheduled_post = Post.objects.create(
            url='scheduled-update-post',
            title='Scheduled Update Post',
            author=author,
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=scheduled_post, content_html='<p>Scheduled</p>')
        PostConfig.objects.create(post=scheduled_post, hide=False, advertise=False)
        next_reserved_date = timezone.now() + timezone.timedelta(days=3)
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/users/@author/posts/scheduled-update-post', {
            'title': 'Scheduled Update Post',
            'text_html': '<p>Scheduled</p>',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': next_reserved_date.isoformat(),
        })

        self.assertEqual(response.status_code, 200)
        scheduled_post.refresh_from_db()
        self.assertAlmostEqual(
            scheduled_post.published_date.timestamp(),
            next_reserved_date.timestamp(),
            delta=1,
        )

    def test_update_scheduled_post_reserved_date_rejects_empty_value(self):
        """예약 시간 수정 API는 빈 예약 시간을 성공 처리하지 않는다."""
        author = User.objects.get(username='author')
        scheduled_post = Post.objects.create(
            url='scheduled-empty-reserved-date',
            title='Scheduled Empty Reserved Date',
            author=author,
            published_date=timezone.now() + timezone.timedelta(days=1),
        )
        PostContent.objects.create(post=scheduled_post, content_html='<p>Scheduled</p>')
        PostConfig.objects.create(post=scheduled_post, hide=False, advertise=False)
        self.client.login(username='author', password='author')

        response = self.client.put(
            '/v1/users/@author/posts/scheduled-empty-reserved-date?reserved_date=1',
            data='',
            content_type='application/x-www-form-urlencoded',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')
        self.assertEqual(content['errorMessage'], '예약 시간을 확인해주세요.')

        english_response = self.client.put(
            '/v1/users/@author/posts/scheduled-empty-reserved-date?reserved_date=1',
            data='',
            content_type='application/x-www-form-urlencoded',
            HTTP_ACCEPT_LANGUAGE='en',
        )
        english_content = json.loads(english_response.content)
        self.assertEqual(english_content['status'], 'ERROR')
        self.assertEqual(english_content['errorCode'], 'error:VA')
        self.assertEqual(english_content['errorMessage'], 'Check the scheduled time.')

    def test_cancel_post_schedule_returns_post_to_draft(self):
        """예약 취소는 내용과 설정을 보존한 채 포스트를 임시글로 되돌린다."""
        scheduled_post = self._create_scheduled_post(
            'scheduled-cancel-post',
            hide=True,
            advertise=True,
        )
        previous_updated_date = scheduled_post.updated_date
        self.client.login(username='author', password='author')

        response = self.client.post(
            '/v1/users/@author/posts/scheduled-cancel-post/schedule/cancel'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body'], {
            'url': 'scheduled-cancel-post',
            'status': 'draft',
        })
        scheduled_post.refresh_from_db()
        self.assertIsNone(scheduled_post.published_date)
        self.assertGreater(scheduled_post.updated_date, previous_updated_date)
        self.assertEqual(
            scheduled_post.content.content_html,
            '<p>Scheduled lifecycle body</p>',
        )
        self.assertTrue(scheduled_post.config.hide)
        self.assertTrue(scheduled_post.config.advertise)

        repeated_response = self.client.post(
            '/v1/users/@author/posts/scheduled-cancel-post/schedule/cancel'
        )
        repeated_content = json.loads(repeated_response.content)
        self.assertEqual(repeated_content['status'], 'ERROR')
        self.assertEqual(repeated_content['errorCode'], 'error:RJ')

    @patch('board.services.post_service.WebhookService.notify_channels')
    def test_publish_scheduled_post_now_notifies_once(self, mock_notify):
        """즉시 발행은 예약 포스트를 공개 상태로 바꾸고 알림을 한 번만 보낸다."""
        scheduled_post = self._create_scheduled_post('scheduled-publish-now-post')
        self.client.login(username='author', password='author')

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                '/v1/users/@author/posts/scheduled-publish-now-post/schedule/publish-now'
            )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['status'], 'published')
        self.assertEqual(content['body']['url'], 'scheduled-publish-now-post')
        self.assertIn('publishedDate', content['body'])
        scheduled_post.refresh_from_db()
        self.assertLessEqual(scheduled_post.published_date, timezone.now())
        mock_notify.assert_called_once()

        with self.captureOnCommitCallbacks(execute=True):
            repeated_response = self.client.post(
                '/v1/users/@author/posts/scheduled-publish-now-post/schedule/publish-now'
            )
        repeated_content = json.loads(repeated_response.content)
        self.assertEqual(repeated_content['status'], 'ERROR')
        self.assertEqual(repeated_content['errorCode'], 'error:RJ')
        mock_notify.assert_called_once()

    def test_schedule_actions_reject_non_scheduled_posts(self):
        """임시글과 이미 발행된 글에는 예약 상태 액션을 적용하지 않는다."""
        draft = self._create_scheduled_post('schedule-action-draft')
        draft.published_date = None
        draft.save(update_fields=['published_date'])
        published = Post.objects.get(url='test-post-2')
        original_published_date = published.published_date
        self.client.login(username='author', password='author')

        for post in (draft, published):
            for action in ('cancel', 'publish-now'):
                with self.subTest(post=post.url, action=action):
                    response = self.client.post(
                        f'/v1/users/@author/posts/{post.url}/schedule/{action}'
                    )
                    content = json.loads(response.content)
                    self.assertEqual(content['status'], 'ERROR')
                    self.assertEqual(content['errorCode'], 'error:RJ')

        draft.refresh_from_db()
        published.refresh_from_db()
        self.assertIsNone(draft.published_date)
        self.assertEqual(published.published_date, original_published_date)

    def test_schedule_actions_reject_another_editor(self):
        """다른 작가는 예약 포스트의 상태를 전환할 수 없다."""
        scheduled_post = self._create_scheduled_post('other-editor-scheduled-post')
        other_editor = User.objects.create_user(
            username='other-editor',
            password='other-editor',
            email='other-editor@example.com',
        )
        Profile.objects.create(user=other_editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=other_editor)
        self.client.login(username='other-editor', password='other-editor')

        for action in ('cancel', 'publish-now'):
            with self.subTest(action=action):
                response = self.client.post(
                    f'/v1/users/@author/posts/{scheduled_post.url}/schedule/{action}'
                )
                self.assertEqual(response.status_code, 404)

        scheduled_post.refresh_from_db()
        self.assertGreater(scheduled_post.published_date, timezone.now())

    def test_get_user_post_detail_edit_mode_with_not_exist_post(self):
        """존재하지 않는 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@author/posts/not-exist-post', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_exist_user(self):
        """존재하지 않는 사용자의 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-exist-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_get_user_post_detail_edit_mode_with_not_match_user(self):
        """작성자가 일치하지 않는 포스트 편집 모드 접근 시 404 에러 테스트"""
        self.client.login(username='author', password='author')

        params = {'mode': 'edit'}
        response = self.client.get(
            '/v1/users/@not-test-user/posts/test-post-1', params)
        self.assertEqual(response.status_code, 404)

    def test_create_post_duplicate_url(self):
        """중복된 URL로 포스트 생성 시 자동 URL 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(len(content['body']['url']),
                         len('test-post-1-00000000'))

    def test_create_post_custom_url(self):
        """커스텀 URL로 포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'url': 'custom-url'
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'custom-url')

    def test_create_post(self):
        """포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post 1000',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'block_comment': 'true',
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['url'], 'test-post-1000')
        post = Post.objects.get(url='test-post-1000')
        self.assertTrue(post.config.block_comment)

    def test_published_post_enforces_subtitle_model_boundary(self):
        """발행 생성은 120자를 허용하고 초과 수정은 기존 부제목을 보존한다."""
        self.client.login(username='author', password='author')
        subtitle_limit = Post._meta.get_field('subtitle').max_length
        accepted_subtitle = '가' * subtitle_limit

        create_response = self.client.post('/v1/posts', {
            'title': 'Published Subtitle Boundary',
            'subtitle': accepted_subtitle,
            'text_html': '<p>content</p>',
            'is_hide': False,
            'is_advertise': False,
        })
        create_content = json.loads(create_response.content)

        self.assertEqual(create_content['status'], 'DONE')
        post = Post.objects.get(url=create_content['body']['url'])
        self.assertEqual(post.subtitle, accepted_subtitle)

        update_response = self.client.post(
            f'/v1/users/@author/posts/{post.url}',
            {
                'title': post.title,
                'subtitle': accepted_subtitle + '나',
                'text_html': post.content.content_html,
                'is_hide': post.config.hide,
                'is_advertise': post.config.advertise,
            },
        )
        update_content = json.loads(update_response.content)

        self.assertEqual(update_content['status'], 'ERROR')
        self.assertEqual(update_content['errorCode'], 'error:OF')
        post.refresh_from_db()
        self.assertEqual(post.subtitle, accepted_subtitle)

    def test_create_post_with_cover_options(self):
        """포스트 생성 시 커버 설정을 저장한다."""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Cover Options Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'cover_layout': 'split',
            'cover_image_position': 'left',
            'cover_image_ratio': '4:3',
        })
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        post = Post.objects.get(url=content['body']['url'])
        self.assertEqual(post.config.cover_layout, 'split')
        self.assertEqual(post.config.cover_image_position, 'left')
        self.assertEqual(post.config.cover_image_ratio, '4:3')

    def test_create_post_rejects_invalid_cover_layout(self):
        """지원하지 않는 커버 설정은 저장하지 않는다."""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Invalid Cover Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'cover_layout': 'invalid',
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertFalse(Post.objects.filter(title='Invalid Cover Post').exists())

    def test_create_post_with_not_logged_in_user(self):
        """비로그인 사용자의 포스트 생성 차단 테스트"""
        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })

        self.assertEqual(response.status_code, 404)

    def test_create_post_empty_title(self):
        """빈 제목으로 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': '',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_empty_text(self):
        """빈 내용으로 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '',
            'is_hide': False,
            'is_advertise': False,
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_reserved(self):
        """예약 포스트 생성 및 공개 제한 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() + datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['body']['url'], 'test-reserved-post')

        params = {'mode': 'view'}
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 200)

        self.client.logout()
        response = self.client.get(
            '/v1/users/@author/posts/test-reserved-post', params)
        self.assertEqual(response.status_code, 404)
    
    def test_create_post_reserved_before(self):
        """과거 날짜로 예약 포스트 생성 시 에러 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Reserved Post',
            'text_html': '# Test Reserved Post',
            'is_hide': False,
            'is_advertise': False,
            'reserved_date': f"{(datetime.date.today() - datetime.timedelta(days=1)).strftime('%Y-%m-%d')}T12:00:00.000Z"
        })
        self.assertEqual(response.json()['status'], 'ERROR')

    def test_create_post_custom_description(self):
        """커스텀 설명을 포함한 포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        post = Post.objects.get(url=content['body']['url'])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.meta_description, 'Custom Description')
    
    def test_create_post_without_invitation(self):
        """초대받지 않은 사용자의 포스트 생성 차단 테스트"""
        self.client.login(username='viewer', password='viewer')

        response = self.client.post('/v1/posts', {
            'title': 'Test Post',
            'text_html': '# Test Post',
            'is_hide': False,
            'is_advertise': False,
            'description': 'Custom Description'
        })
        content = json.loads(response.content)
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_create_post_markdown_mode(self):
        """마크다운 모드 포스트 생성 테스트"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Markdown Post',
            'text_html': '# Hello World\n\nThis is **markdown**.',
            'is_hide': False,
            'is_advertise': False,
            'content_type': 'markdown',
        })
        content = json.loads(response.content)
        self.assertEqual(response.status_code, 200)

        post = Post.objects.get(url=content['body']['url'])
        self.assertIn('<strong>markdown</strong>', post.content.content_html)

    def test_markdown_conversion_requires_csrf_token_when_enforced(self):
        """세션 기반 마크다운 변환 API는 CSRF 토큰을 요구한다."""
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.login(username='author', password='author')

        response = csrf_client.post(
            '/v1/markdown',
            data=json.dumps({'text': '# Missing CSRF'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_markdown_conversion_error_follows_the_request_language(self):
        self.client.login(username='author', password='author')

        response = self.client.post(
            '/v1/markdown',
            data=json.dumps({'text': ''}),
            content_type='application/json',
            HTTP_ACCEPT_LANGUAGE='en',
        )

        content = json.loads(response.content)
        self.assertEqual(content['errorCode'], 'error:IP')
        self.assertEqual(content['errorMessage'], 'Text cannot be empty.')

    def test_create_post_markdown_mode_does_not_render_mentions(self):
        """포스트 마크다운에서는 멘션이 링크로 변환되지 않아야 함"""
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/posts', {
            'title': 'Markdown Mention Post',
            'text_html': '`@viewer` in post',
            'is_hide': False,
            'is_advertise': False,
            'content_type': 'markdown',
        })
        content = json.loads(response.content)
        self.assertEqual(response.status_code, 200)

        post = Post.objects.get(url=content['body']['url'])
        self.assertNotIn('class="mention"', post.content.content_html)
        self.assertIn('<code>@viewer</code>', post.content.content_html)

    def test_get_post_edit_mode_markdown(self):
        """마크다운 모드 포스트 편집 모드 조회 시 text_md 반환 테스트"""
        self.client.login(username='author', password='author')

        # Create a markdown post
        response = self.client.post('/v1/posts', {
            'title': 'MD Edit Test',
            'text_html': '# Edit me',
            'is_hide': False,
            'is_advertise': False,
            'content_type': 'markdown',
        })
        post_url = json.loads(response.content)['body']['url']

        # Fetch in edit mode
        response = self.client.get(f'/v1/users/@author/posts/{post_url}', {'mode': 'edit'})
        content = json.loads(response.content)
        self.assertIn('Edit me', content['body']['contentHtml'])

    def test_update_post_markdown_mode(self):
        """마크다운 모드 포스트 수정 테스트"""
        self.client.login(username='author', password='author')

        # Create a markdown post
        response = self.client.post('/v1/posts', {
            'title': 'MD Update Test',
            'text_html': '# Before',
            'is_hide': False,
            'is_advertise': False,
            'content_type': 'markdown',
        })
        post_url = json.loads(response.content)['body']['url']

        # Update the post
        response = self.client.post(f'/v1/users/@author/posts/{post_url}', {
            'title': 'MD Update Test',
            'text_html': '# After\n\nUpdated **content**.',
            'is_hide': False,
            'is_advertise': False,
            'content_type': 'markdown',
        })
        self.assertEqual(response.status_code, 200)

        post = Post.objects.get(url=post_url)
        self.assertIn('<strong>content</strong>', post.content.content_html)

    def _create_test_image(self, name='test.jpg', size=(100, 100), color='red'):
        """테스트용 이미지 파일 생성 헬퍼 메소드"""
        file = BytesIO()
        image = Image.new('RGB', size, color)
        image.save(file, 'JPEG')
        file.seek(0)
        return SimpleUploadedFile(
            name,
            file.read(),
            content_type='image/jpeg'
        )

    def test_update_post_add_image(self):
        """이미지가 없는 포스트에 이미지 추가 테스트"""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-1')
        # 초기 상태 확인: 이미지가 없음
        self.assertFalse(post.image)

        # 이미지와 함께 포스트 업데이트
        image = self._create_test_image('new_image.jpg')
        response = self.client.post('/v1/users/@author/posts/test-post-1', {
            'title': post.title,
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image': image,
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        # 파일명은 title_image_path 함수에 의해 자동 생성되므로 경로만 확인
        self.assertIn('images/title/', post.image.name)
        self.assertIn('/author/', post.image.name)

    def test_update_post_change_image(self):
        """기존 이미지를 새 이미지로 변경 테스트"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-2')
        old_image = self._create_test_image('old_image.jpg', color='blue')
        post.image = old_image
        post.save()
        old_image_name = post.image.name

        # 새 이미지로 변경
        new_image = self._create_test_image('new_image.jpg', color='red')
        response = self.client.post('/v1/users/@author/posts/test-post-2', {
            'title': post.title,
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image': new_image,
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        # 파일명은 title_image_path 함수에 의해 자동 생성되므로 경로만 확인
        self.assertIn('images/title/', post.image.name)
        self.assertIn('/author/', post.image.name)
        self.assertNotEqual(post.image.name, old_image_name)

    def test_update_post_delete_image(self):
        """포스트의 이미지 삭제 테스트"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-3')
        image = self._create_test_image('to_delete.jpg')
        post.image = image
        post.save()

        # 이미지가 있는지 확인
        self.assertTrue(post.image)

        # image_delete 플래그와 함께 업데이트
        response = self.client.post('/v1/users/@author/posts/test-post-3', {
            'title': post.title,
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'image_delete': 'true',
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertFalse(post.image)

    def test_update_post_keep_existing_image(self):
        """기존 이미지를 유지하는 테스트 (이미지 필드를 건드리지 않음)"""
        self.client.login(username='author', password='author')

        # 먼저 이미지가 있는 포스트 생성
        post = Post.objects.get(url='test-post-4')
        image = self._create_test_image('keep_image.jpg')
        post.image = image
        post.save()
        original_image_name = post.image.name

        # 이미지 필드 없이 다른 필드만 업데이트
        response = self.client.post('/v1/users/@author/posts/test-post-4', {
            'title': post.title + ' Updated',
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            # image 필드 없음 - 기존 이미지 유지되어야 함
        })

        # 응답 확인
        self.assertEqual(response.status_code, 200)

        # 데이터베이스에서 다시 가져와서 확인
        post.refresh_from_db()
        self.assertTrue(post.image)
        self.assertEqual(post.image.name, original_image_name)
        self.assertEqual(post.title, 'Test Post 4 Updated')

    def test_update_post_cover_options(self):
        """포스트 수정 시 커버 설정을 갱신한다."""
        self.client.login(username='author', password='author')

        post = Post.objects.get(url='test-post-5')
        response = self.client.post('/v1/users/@author/posts/test-post-5', {
            'title': post.title,
            'text_html': post.content.content_html,
            'is_hide': post.config.hide,
            'is_advertise': post.config.advertise,
            'cover_layout': 'none',
            'cover_image_position': 'right',
            'cover_image_ratio': 'auto',
        })

        self.assertEqual(response.status_code, 200)
        post.config.refresh_from_db()
        self.assertEqual(post.config.cover_layout, 'none')
        self.assertEqual(post.config.cover_image_position, 'right')
        self.assertEqual(post.config.cover_image_ratio, 'auto')

    def test_related_posts_rejects_hidden_post_for_non_owner(self):
        """관련 글 API는 숨김 글을 비작성자에게 노출하지 않는다."""
        post = Post.objects.get(url='test-post-1')
        post.config.hide = True
        post.config.save()

        response = self.client.get('/v1/users/@author/posts/test-post-1/related')

        self.assertEqual(response.status_code, 404)

    def test_related_posts_adds_iso_dates_without_replacing_display_date(self):
        """관련 글 날짜 계약은 기존 표시값을 유지하고 기계 판독 날짜를 추가한다."""
        reference = Post.objects.get(url='test-post-1')
        candidate = Post.objects.get(url='test-post-2')
        tag = Tag.objects.create(value='related-api-contract')
        reference.tags.add(tag)
        candidate.tags.add(tag)

        response = self.client.get('/v1/users/@author/posts/test-post-1/related')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        related_post = content['body']['posts'][0]
        self.assertEqual(
            related_post['publishedDate'],
            time_since(candidate.published_date),
        )
        self.assertEqual(
            related_post['publishedAt'],
            candidate.published_date.isoformat(),
        )
        self.assertEqual(
            related_post['publishedDateIso'],
            timezone.localdate(candidate.published_date).isoformat(),
        )

    def test_related_posts_rejects_draft_post_for_non_owner(self):
        """관련 글 API는 임시저장 글을 비작성자에게 노출하지 않는다."""
        post = Post.objects.get(url='test-post-1')
        post.published_date = None
        post.save(update_fields=['published_date'])

        response = self.client.get('/v1/users/@author/posts/test-post-1/related')

        self.assertEqual(response.status_code, 404)

    def test_related_posts_rejects_scheduled_post_for_non_owner(self):
        """관련 글 API는 미래 발행 글을 비작성자에게 노출하지 않는다."""
        post = Post.objects.get(url='test-post-1')
        post.published_date = timezone.now() + timezone.timedelta(days=1)
        post.save(update_fields=['published_date'])

        response = self.client.get('/v1/users/@author/posts/test-post-1/related')

        self.assertEqual(response.status_code, 404)

    def test_post_detail_hidden_in_series(self):
        """시리즈에 포함된 숨김 포스트 조회 시 에러 없이 안내 문구 표시 테스트"""
        self.client.login(username='author', password='author')
        
        # 시리즈 생성
        author = User.objects.get(username='author')
        series = Series.objects.create(owner=author, name='Test Series', url='test-series')
        
        # 기존 포스트를 시리즈에 연결
        post = Post.objects.get(url='test-post-1')
        post.series = series
        post.save()
        
        # 포스트 숨김 처리
        post.config.hide = True
        post.config.save()
        
        # 뷰 페이지 조회 (템플릿 뷰)
        response = self.client.get('/@author/test-post-1')
        self.assertEqual(response.status_code, 200)
        # 안내 문구 확인
        self.assertContains(response, '이 포스트는 숨김 처리되어 시리즈 목록에 표시되지 않습니다.')
