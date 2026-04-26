import json

from django.test import TestCase

from board.models import Config, DeveloperToken, Profile, User
from board.services.developer_token_service import DeveloperTokenService


class DeveloperAuthAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.editor = User.objects.create_user(
            username='developer',
            password='developer',
            email='developer@example.com',
            first_name='Developer',
        )
        Profile.objects.create(user=cls.editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.editor)

        cls.reader = User.objects.create_user(
            username='reader',
            password='reader',
            email='reader@example.com',
        )
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)
        Config.objects.create(user=cls.reader)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def test_create_developer_token_requires_login(self):
        response = self.client.post(
            '/v1/developer-tokens',
            json.dumps({'name': 'MCP', 'scopes': ['posts:read']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'ERROR')
        self.assertEqual(body['errorCode'], 'error:NL')

    def test_editor_can_create_developer_token(self):
        self.client.login(username='developer', password='developer')

        response = self.client.post(
            '/v1/developer-tokens',
            json.dumps({
                'name': 'MCP Client',
                'scopes': ['posts:read', 'posts:write'],
                'expires_in_days': 30,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'DONE')
        self.assertTrue(body['body']['token'].startswith('blex_pat_'))
        self.assertEqual(body['body']['name'], 'MCP Client')
        self.assertEqual(body['body']['scopes'], ['posts:read', 'posts:write'])

        token = DeveloperToken.objects.get(user=self.editor)
        self.assertEqual(token.token_prefix, body['body']['tokenPrefix'])
        self.assertNotEqual(token.token_hash, body['body']['token'])
        self.assertEqual(
            token.token_hash,
            DeveloperTokenService.hash_token(body['body']['token']),
        )

    def test_reader_cannot_create_write_scope_token(self):
        self.client.login(username='reader', password='reader')

        response = self.client.post(
            '/v1/developer-tokens',
            json.dumps({'name': 'Writer', 'scopes': ['posts:write']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'ERROR')
        self.assertEqual(body['errorCode'], 'error:RJ')

    def test_me_requires_bearer_token(self):
        response = self.client.get('/api/developer/v1/me')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error']['code'], 'auth.missing_token')

    def test_me_returns_authenticated_developer(self):
        raw_token, token = DeveloperTokenService.create_token(
            self.editor,
            name='MCP',
            scopes=['posts:read'],
        )

        response = self.client.get(
            '/api/developer/v1/me',
            HTTP_AUTHORIZATION=f'Bearer {raw_token}',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()['data']
        self.assertEqual(body['user']['username'], 'developer')
        self.assertEqual(body['token']['token_prefix'], token.token_prefix)
        self.assertEqual(body['token']['scopes'], ['posts:read'])

        token.refresh_from_db()
        self.assertIsNotNone(token.last_used_at)

    def test_revoked_token_is_rejected(self):
        raw_token, token = DeveloperTokenService.create_token(
            self.editor,
            name='MCP',
            scopes=['posts:read'],
        )
        DeveloperTokenService.revoke_token(token)

        response = self.client.get(
            '/api/developer/v1/me',
            HTTP_AUTHORIZATION=f'Bearer {raw_token}',
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['error']['code'], 'auth.invalid_token')
