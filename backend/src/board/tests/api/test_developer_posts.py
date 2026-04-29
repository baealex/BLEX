import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from board.models import Config, Post, Profile, Series, User
from board.modules.developer_serializers import DeveloperPostSerializer
from board.services.developer_token_service import DeveloperTokenService


class DeveloperPostsAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='author',
            password='author',
            email='author@example.com',
            first_name='Author',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.other = User.objects.create_user(
            username='other',
            password='other',
            email='other@example.com',
        )
        Profile.objects.create(user=cls.other, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other)

        cls.raw_token, _ = DeveloperTokenService.create_token(
            cls.author,
            name='Full access',
            scopes=['posts:read', 'posts:write'],
        )
        cls.read_token, _ = DeveloperTokenService.create_token(
            cls.author,
            name='Read only',
            scopes=['posts:read'],
        )
        cls.other_token, _ = DeveloperTokenService.create_token(
            cls.other,
            name='Other',
            scopes=['posts:read', 'posts:write'],
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def auth_header(self, token=None):
        return {
            'HTTP_AUTHORIZATION': f'Bearer {token or self.raw_token}',
        }

    def post_json(self, url, body, token=None):
        return self.client.post(
            url,
            json.dumps(body),
            content_type='application/json',
            **self.auth_header(token),
        )

    def patch_json(self, url, body, token=None):
        return self.client.patch(
            url,
            json.dumps(body),
            content_type='application/json',
            **self.auth_header(token),
        )

    def create_draft(self, title='API Draft', content='# Hello\n\nThis is **bold**', tags=None, series_id=None):
        body = {
            'title': title,
            'content': content,
            'content_type': 'markdown',
            'tags': tags if tags is not None else ['api', 'mcp'],
        }
        if series_id is not None:
            body['series_id'] = series_id

        response = self.post_json('/api/developer/v1/posts', {
            **body,
        })
        self.assertEqual(response.status_code, 201)
        return response.json()['data']

    def test_create_markdown_draft(self):
        data = self.create_draft()

        self.assertEqual(data['status'], 'draft')
        self.assertEqual(data['content_type'], 'markdown')
        self.assertEqual(data['content'], '# Hello\n\nThis is **bold**')
        self.assertIn('<strong>bold</strong>', data['rendered_html'])

        post = Post.objects.get(id=data['id'])
        self.assertIsNone(post.published_date)
        self.assertEqual(post.content.text_md, '# Hello\n\nThis is **bold**')
        self.assertEqual(sorted(post.tags.values_list('value', flat=True)), ['api', 'mcp'])

    def test_list_posts_includes_draft_status(self):
        draft = self.create_draft('List Draft')

        response = self.client.get(
            '/api/developer/v1/posts?status=draft',
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()['data']
        self.assertEqual(body['pagination']['total'], 1)
        self.assertEqual(body['posts'][0]['id'], draft['id'])
        self.assertEqual(body['posts'][0]['status'], 'draft')

    def test_serialized_tags_use_prefetch_cache(self):
        draft = self.create_draft('Cached Tags Draft')
        post = Post.objects.prefetch_related('tags').get(id=draft['id'])

        with CaptureQueriesContext(connection) as queries:
            tags = DeveloperPostSerializer.tags(post)

        self.assertEqual(tags, ['api', 'mcp'])
        self.assertEqual(len(queries), 0)

    def test_get_post_detail_returns_raw_and_rendered_content(self):
        draft = self.create_draft('Detail Draft')

        response = self.client.get(
            f"/api/developer/v1/posts/{draft['id']}",
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['title'], 'Detail Draft')
        self.assertEqual(data['content'], '# Hello\n\nThis is **bold**')
        self.assertIn('This is', data['rendered_html'])

    def test_create_published_post(self):
        response = self.post_json('/api/developer/v1/posts', {
            'title': 'Published API Post',
            'content': '<p>Public content</p>',
            'content_type': 'html',
            'status': 'published',
            'tags': ['public'],
        })

        self.assertEqual(response.status_code, 201)
        data = response.json()['data']
        self.assertEqual(data['status'], 'published')
        self.assertIsNotNone(data['published_at'])

        post = Post.objects.get(id=data['id'])
        self.assertTrue(post.is_published())

    def test_patch_post_with_expected_updated_at(self):
        draft = self.create_draft('Patch Draft')

        response = self.patch_json(f"/api/developer/v1/posts/{draft['id']}", {
            'expected_updated_at': draft['updated_at'],
            'title': 'Updated Draft',
            'content': '# Updated',
            'tags': ['updated'],
        })

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['title'], 'Updated Draft')
        self.assertEqual(data['content'], '# Updated')
        self.assertEqual(data['tags'], ['updated'])

    def test_patch_post_with_stale_expected_updated_at_returns_conflict(self):
        draft = self.create_draft('Conflict Draft')

        response = self.patch_json(f"/api/developer/v1/posts/{draft['id']}", {
            'expected_updated_at': '2020-01-01T00:00:00+00:00',
            'title': 'Should Not Apply',
        })

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['error']['code'], 'post.version_conflict')

        post = Post.objects.get(id=draft['id'])
        self.assertEqual(post.title, 'Conflict Draft')

    def test_publish_draft(self):
        draft = self.create_draft('Publish Draft')

        response = self.post_json(f"/api/developer/v1/posts/{draft['id']}/publish", {
            'title': 'Published Draft',
        })

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['status'], 'published')
        self.assertEqual(data['title'], 'Published Draft')

        post = Post.objects.get(id=draft['id'])
        self.assertTrue(post.is_published())

    def test_other_user_token_cannot_access_post(self):
        draft = self.create_draft('Private Draft')

        response = self.client.get(
            f"/api/developer/v1/posts/{draft['id']}",
            **self.auth_header(self.other_token),
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()['error']['code'], 'post.not_found')

    def test_read_only_token_cannot_create_post(self):
        response = self.post_json('/api/developer/v1/posts', {
            'title': 'Forbidden',
            'content': 'No',
        }, token=self.read_token)

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error']['code'], 'auth.insufficient_scope')

    def test_delete_post_supports_dry_run(self):
        draft = self.create_draft('Delete Draft')

        dry_run = self.client.delete(
            f"/api/developer/v1/posts/{draft['id']}?dry_run=true",
            **self.auth_header(),
        )
        self.assertEqual(dry_run.status_code, 200)
        self.assertTrue(Post.objects.filter(id=draft['id']).exists())

        response = self.client.delete(
            f"/api/developer/v1/posts/{draft['id']}",
            **self.auth_header(),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['deleted'], True)
        self.assertFalse(Post.objects.filter(id=draft['id']).exists())

    def test_search_posts_filters_by_query_tag_and_status(self):
        """개발자 API 글 검색은 내 글의 본문, 태그, 상태를 함께 필터링한다."""
        matched = self.create_draft(
            'MCP Publish Draft',
            content='AI publishing adapter content',
            tags=['mcp', 'publish'],
        )
        self.create_draft(
            'Unrelated Draft',
            content='private wiki content',
            tags=['wiki'],
        )

        response = self.client.get(
            '/api/developer/v1/posts/search?q=publishing&tag=mcp&status=draft',
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']
        self.assertEqual(data['pagination']['total'], 1)
        self.assertEqual(data['posts'][0]['id'], matched['id'])

    def test_list_tags_returns_author_tags_only(self):
        """태그 목록은 토큰 소유자의 글에 연결된 태그만 반환한다."""
        self.create_draft('Tagged Draft', tags=['api', 'mcp'])
        self.post_json('/api/developer/v1/posts', {
            'title': 'Other Tagged Draft',
            'content': 'Other content',
            'content_type': 'markdown',
            'tags': ['secret'],
        }, token=self.other_token)

        response = self.client.get(
            '/api/developer/v1/tags',
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        tags = {
            tag['name']: tag['post_count']
            for tag in response.json()['data']['tags']
        }
        self.assertEqual(tags, {'api': 1, 'mcp': 1})
        self.assertNotIn('secret', tags)

    def test_list_series_returns_owned_series_with_post_count(self):
        """시리즈 목록은 내 시리즈와 연결된 글 수를 반환한다."""
        series = Series.objects.create(
            owner=self.author,
            name='MCP Guide',
            text_md='Guide description',
            url='mcp-guide',
        )
        Series.objects.create(
            owner=self.other,
            name='Other Guide',
            url='other-guide',
        )
        self.create_draft('Series Draft', series_id=series.id)

        response = self.client.get(
            '/api/developer/v1/series',
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()['data']['series']
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], series.id)
        self.assertEqual(data[0]['name'], 'MCP Guide')
        self.assertEqual(data[0]['description'], 'Guide description')
        self.assertEqual(data[0]['post_count'], 1)

    @patch('board.views.api.developer.v1.publishing.ImageUploadService.upload_content_image')
    def test_upload_image_uses_developer_token(self, mock_upload):
        """개발자 API 이미지 업로드는 posts:write 토큰으로 이미지 URL을 반환한다."""
        mock_upload.return_value = '/media/images/content/test.png'
        uploaded_file = SimpleUploadedFile(
            'test.png',
            b'fake image',
            content_type='image/png',
        )

        response = self.client.post(
            '/api/developer/v1/images',
            {'image': uploaded_file},
            **self.auth_header(),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.json()['data']['url'],
            '/media/images/content/test.png',
        )
        self.assertEqual(mock_upload.call_args.kwargs['user'], self.author)

    @patch('board.views.api.developer.v1.publishing.ImageUploadService.upload_content_image')
    def test_upload_image_requires_write_scope(self, mock_upload):
        """읽기 전용 토큰은 이미지 업로드를 할 수 없다."""
        uploaded_file = SimpleUploadedFile(
            'test.png',
            b'fake image',
            content_type='image/png',
        )

        response = self.client.post(
            '/api/developer/v1/images',
            {'image': uploaded_file},
            **self.auth_header(self.read_token),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error']['code'], 'auth.insufficient_scope')
        mock_upload.assert_not_called()
