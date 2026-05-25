import json
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from board.models import Config, Post, Profile, User
from board.services.developer_token_service import DeveloperTokenService


class DeveloperWorkflowAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='workflow-author',
            password='author',
            email='workflow-author@example.com',
            first_name='Workflow Author',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)
        cls.raw_token, _ = DeveloperTokenService.create_token(
            cls.author,
            name='Workflow token',
            scopes=['posts:read', 'posts:write'],
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def auth_header(self):
        return {
            'HTTP_AUTHORIZATION': f'Bearer {self.raw_token}',
        }

    def post_json(self, url, body):
        return self.client.post(
            url,
            json.dumps(body),
            content_type='application/json',
            **self.auth_header(),
        )

    def patch_json(self, url, body):
        return self.client.patch(
            url,
            json.dumps(body),
            content_type='application/json',
            **self.auth_header(),
        )

    @patch('board.views.api.developer.v1.api.ImageUploadService.upload_content_image')
    def test_upload_create_update_publish_and_read_markdown_post(self, mock_upload):
        """대표 자동화 워크플로는 이미지 업로드부터 발행 후 상세 조회까지 통과한다."""
        mock_upload.return_value = '/media/images/content/workflow.png'
        image = SimpleUploadedFile(
            'workflow.png',
            b'fake image',
            content_type='image/png',
        )

        upload_response = self.client.post(
            '/api/developer/v1/images',
            {'image': image},
            **self.auth_header(),
        )
        self.assertEqual(upload_response.status_code, 201)
        image_url = upload_response.json()['data']['url']

        create_response = self.post_json('/api/developer/v1/posts', {
            'status': 'draft',
            'title': 'Workflow Draft',
            'content': f'# Workflow\n\n![cover]({image_url})',
            'content_type': 'markdown',
            'tags': ['workflow'],
        })
        self.assertEqual(create_response.status_code, 201)
        draft = create_response.json()['data']
        self.assertEqual(draft['status'], 'draft')
        self.assertIn('<img', draft['content_html'])

        update_response = self.patch_json(f"/api/developer/v1/posts/{draft['id']}", {
            'expected_updated_at': draft['updated_at'],
            'description': 'Workflow API description',
            'tags': ['workflow', 'published'],
        })
        self.assertEqual(update_response.status_code, 200)
        updated = update_response.json()['data']
        self.assertEqual(updated['description'], 'Workflow API description')
        self.assertEqual(updated['tags'], ['published', 'workflow'])

        publish_response = self.post_json(f"/api/developer/v1/posts/{draft['id']}/publish", {})
        self.assertEqual(publish_response.status_code, 200)
        published = publish_response.json()['data']
        self.assertEqual(published['status'], 'published')
        self.assertIsNotNone(published['published_at'])

        detail_response = self.client.get(
            f"/api/developer/v1/posts/{draft['id']}",
            **self.auth_header(),
        )
        self.assertEqual(detail_response.status_code, 200)
        detail = detail_response.json()['data']
        self.assertEqual(detail['status'], 'published')
        self.assertIn(image_url, detail['content_html'])
        self.assertIn('<img', detail['rendered_html'])

        post = Post.objects.get(id=draft['id'])
        self.assertTrue(post.is_published())
