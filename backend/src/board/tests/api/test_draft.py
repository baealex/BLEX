import json
from datetime import timedelta
from io import BytesIO

from PIL import Image

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Profile
from board.services.post_service import PostService


class DraftTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )
        Profile.objects.create(
            user=cls.user,
            role=Profile.Role.EDITOR
        )

        cls.other_user = User.objects.create_user(
            username='other',
            password='other',
            email='other@test.com',
        )
        Profile.objects.create(
            user=cls.other_user,
            role=Profile.Role.EDITOR
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def _create_test_image(self, name='test.jpg'):
        image = Image.new('RGB', (10, 10), color='red')
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        buffer.seek(0)
        return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/jpeg')

    def _create_draft(self, title='Test Draft', content='<p>Draft content</p>', tags='test'):
        """Helper to create a draft and return its URL."""
        self.client.login(username='test', password='test')
        response = self.client.post(
            '/v1/drafts',
            json.dumps({'title': title, 'content': content, 'tags': tags}),
            content_type='application/json'
        )
        data = json.loads(response.content)
        return data['body']['url']

    def test_create_draft(self):
        """드래프트 생성 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({
                'title': 'My Draft',
                'content': '<p>Hello world</p>',
                'tags': 'python,django'
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertIn('url', content['body'])

        # Verify it's a draft (published_date is null)
        post = Post.objects.get(url=content['body']['url'])
        self.assertIsNone(post.published_date)
        self.assertTrue(post.is_draft())
        self.assertFalse(post.is_published())

    def test_create_draft_with_cover_options(self):
        """드래프트 생성 시 커버 설정을 저장하고 상세 응답에 반환한다."""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({
                'title': 'Cover Draft',
                'content': '<p>Hello world</p>',
                'tags': 'python,django',
                'cover_layout': 'overlay',
                'cover_image_position': 'left',
                'cover_image_ratio': '1:1',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)['body']

        post = Post.objects.get(url=body['url'])
        self.assertEqual(post.config.cover_layout, 'overlay')
        self.assertEqual(post.config.cover_image_position, 'left')
        self.assertEqual(post.config.cover_image_ratio, '1:1')

        detail_response = self.client.get(f"/v1/drafts/{body['url']}")
        detail = json.loads(detail_response.content)['body']
        self.assertEqual(detail['coverLayout'], 'overlay')
        self.assertEqual(detail['coverImagePosition'], 'left')
        self.assertEqual(detail['coverImageRatio'], '1:1')

    def test_create_draft_empty_title(self):
        """빈 제목으로 드래프트 생성 시 기본 제목"""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({'title': '', 'content': '<p>content</p>'}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        post = Post.objects.get(url=content['body']['url'])
        self.assertEqual(post.title, '제목 없음')

    def test_create_draft_not_logged_in(self):
        """비로그인 시 드래프트 생성 실패"""
        response = self.client.post(
            '/v1/drafts',
            json.dumps({'title': 'Draft'}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_draft_list(self):
        """드래프트 목록 조회 테스트"""
        url1 = self._create_draft(title='Draft 1')
        url2 = self._create_draft(title='Draft 2')

        response = self.client.get('/v1/drafts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']['drafts']), 2)

    def test_get_draft_list_orders_recently_updated_first(self):
        """드래프트 목록은 최근 수정한 글부터 조회"""
        self.client.login(username='test', password='test')
        older_draft = Post.objects.create(
            author=self.user,
            title='Older Draft',
            url='older-draft',
            published_date=None,
            updated_date=timezone.now() - timedelta(days=1),
        )
        recent_draft = Post.objects.create(
            author=self.user,
            title='Recent Draft',
            url='recent-draft',
            published_date=None,
            updated_date=timezone.now(),
        )
        for draft in (older_draft, recent_draft):
            PostContent.objects.create(post=draft, content_html='')
            PostConfig.objects.create(post=draft)

        response = self.client.get('/v1/drafts')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(
            [draft['url'] for draft in content['body']['drafts']],
            ['recent-draft', 'older-draft'],
        )

    def test_get_draft_detail(self):
        """드래프트 상세 조회 테스트"""
        url = self._create_draft(title='Detail Draft', content='<p>Detail content</p>', tags='test,draft')

        response = self.client.get(f'/v1/drafts/{url}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['title'], 'Detail Draft')
        self.assertEqual(content['body']['textMd'], '<p>Detail content</p>')

    def test_update_draft(self):
        """드래프트 수정 테스트"""
        url = self._create_draft()

        response = self.client.put(
            f'/v1/drafts/{url}',
            json.dumps({
                'title': 'Updated Title',
                'content': '<p>Updated content</p>',
                'tags': 'updated',
                'subtitle': 'My subtitle',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        post = Post.objects.get(url=url)
        self.assertEqual(post.title, 'Updated Title')
        self.assertEqual(post.subtitle, 'My subtitle')
        self.assertIsNone(post.published_date)

    def test_update_draft_cover_options(self):
        """드래프트 수정 시 커버 설정을 갱신한다."""
        url = self._create_draft()

        response = self.client.put(
            f'/v1/drafts/{url}',
            json.dumps({
                'cover_layout': 'none',
                'cover_image_position': 'right',
                'cover_image_ratio': 'auto',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

        post = Post.objects.get(url=url)
        self.assertEqual(post.config.cover_layout, 'none')
        self.assertEqual(post.config.cover_image_position, 'right')
        self.assertEqual(post.config.cover_image_ratio, 'auto')

    def test_create_draft_with_image(self):
        """이미지를 포함한 임시저장이 타이틀 이미지를 유지한다."""
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/drafts', {
            'title': 'Image Draft',
            'content': '<p>content</p>',
            'image': self._create_test_image('draft-title.jpg'),
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        post = Post.objects.get(url=content['body']['url'])
        self.assertTrue(post.image)
        self.assertIn('images/title/', post.image.name)

    def test_update_draft_delete_image(self):
        """임시글 이미지 삭제 플래그가 타이틀 이미지를 제거한다."""
        url = self._create_draft(title='Delete Image Draft')
        post = Post.objects.get(url=url)
        post.image = self._create_test_image('draft-delete.jpg')
        post.save()
        self.assertTrue(post.image)

        response = self.client.put(
            f'/v1/drafts/{url}',
            json.dumps({'image_delete': 'true'}),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        post.refresh_from_db()
        self.assertFalse(post.image)

    def test_publish_draft_delete_image(self):
        """이미지 삭제 상태로 임시글을 발행하면 기존 타이틀 이미지를 제거한다."""
        url = self._create_draft(title='Publish Delete Image Draft')
        post = Post.objects.get(url=url)
        post.image = self._create_test_image('draft-publish-delete.jpg')
        post.save()
        self.assertTrue(post.image)

        PostService.publish_draft(
            post=post,
            title=post.title,
            text_html=post.content.content_html,
            image_delete=True,
        )

        post.refresh_from_db()
        self.assertTrue(post.is_published())
        self.assertFalse(post.image)

    def test_update_draft_custom_url_changes_lookup_key(self):
        """드래프트 URL 변경 시 식별 URL이 갱신되어야 함"""
        old_url = self._create_draft(title='URL Draft')

        response = self.client.put(
            f'/v1/drafts/{old_url}',
            json.dumps({
                'custom_url': 'renamed-draft',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        new_url = content['body']['url']
        self.assertNotEqual(old_url, new_url)
        self.assertTrue(Post.objects.filter(url=new_url, author=self.user, published_date__isnull=True).exists())
        self.assertFalse(Post.objects.filter(url=old_url, author=self.user, published_date__isnull=True).exists())

        detail_response = self.client.get(f'/v1/drafts/{new_url}')
        self.assertEqual(detail_response.status_code, 200)

    def test_update_draft_custom_url_same_value_keeps_url(self):
        """동일한 custom_url로 재저장해도 URL이 변경되면 안 됨"""
        url = self._create_draft(title='Stable URL Draft')

        response = self.client.put(
            f'/v1/drafts/{url}',
            json.dumps({
                'custom_url': url,
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['url'], url)

        self.assertTrue(Post.objects.filter(url=url, author=self.user, published_date__isnull=True).exists())

    def test_delete_draft(self):
        """드래프트 삭제 테스트"""
        url = self._create_draft()

        response = self.client.delete(f'/v1/drafts/{url}')
        self.assertEqual(response.status_code, 200)

        self.assertFalse(Post.objects.filter(url=url).exists())

    def test_delete_draft_other_user(self):
        """다른 사용자의 드래프트 삭제 시도 실패"""
        url = self._create_draft()

        self.client.login(username='other', password='other')
        response = self.client.delete(f'/v1/drafts/{url}')
        self.assertEqual(response.status_code, 404)

        # Should still exist
        self.assertTrue(Post.objects.filter(url=url).exists())

    def test_draft_not_visible_in_published_queries(self):
        """드래프트가 발행된 글 목록에 나타나지 않는 것을 확인"""
        url = self._create_draft()

        # Draft should not appear in main page query
        published_posts = Post.objects.filter(
            published_date__isnull=False,
        )
        self.assertEqual(published_posts.filter(url=url).count(), 0)

    def test_create_draft_markdown_mode(self):
        """마크다운 모드 드래프트 생성 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({
                'title': 'Markdown Draft',
                'content': '# Hello\n\nThis is **bold**',
                'tags': 'markdown',
                'content_type': 'markdown',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        post = Post.objects.get(url=content['body']['url'])
        self.assertIn('<h2', post.content.content_html)
        self.assertIn('<strong>bold</strong>', post.content.content_html)

    def test_get_draft_detail_markdown_mode(self):
        """마크다운 모드 드래프트 상세 조회 시 text_md 반환 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({
                'title': 'MD Detail',
                'content': '# Heading',
                'content_type': 'markdown',
            }),
            content_type='application/json'
        )
        draft_url = json.loads(response.content)['body']['url']

        response = self.client.get(f'/v1/drafts/{draft_url}')
        content = json.loads(response.content)
        self.assertIn('Heading', content['body']['contentHtml'])

    def test_update_draft_markdown_mode(self):
        """마크다운 모드 드래프트 수정 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post(
            '/v1/drafts',
            json.dumps({
                'title': 'MD Update',
                'content': '# Original',
                'content_type': 'markdown',
            }),
            content_type='application/json'
        )
        draft_url = json.loads(response.content)['body']['url']

        response = self.client.put(
            f'/v1/drafts/{draft_url}',
            json.dumps({
                'content': '# Updated\n\nNew content',
                'content_type': 'markdown',
            }),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)

        post = Post.objects.get(url=draft_url)
        self.assertIn('<h2', post.content.content_html)

    def test_draft_limit(self):
        """드래프트 100개 제한 테스트"""
        self.client.login(username='test', password='test')

        # Create 100 drafts
        for i in range(100):
            Post.objects.create(
                author=self.user,
                title=f'Bulk Draft {i}',
                url=f'bulk-draft-{i}',
                published_date=None,
            )
            PostContent.objects.create(
                post=Post.objects.get(url=f'bulk-draft-{i}'),
                content_html='',
            )
            PostConfig.objects.create(
                post=Post.objects.get(url=f'bulk-draft-{i}')
            )

        response = self.client.post(
            '/v1/drafts',
            json.dumps({'title': 'One more'}),
            content_type='application/json'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:OF')
