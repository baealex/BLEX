import json

from django.test import TestCase, override_settings

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

        cls.other_editor = User.objects.create_user(
            username='other-developer',
            password='other-developer',
            email='other-developer@example.com',
        )
        Profile.objects.create(user=cls.other_editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_editor)

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

    def test_list_developer_tokens_returns_current_user_tokens(self):
        DeveloperTokenService.create_token(
            self.editor,
            name='Editor token',
            scopes=['posts:read'],
        )
        DeveloperTokenService.create_token(
            self.other_editor,
            name='Other editor token',
            scopes=['posts:read'],
        )
        self.client.login(username='developer', password='developer')

        response = self.client.get('/v1/developer-tokens')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'DONE')
        self.assertEqual(len(body['body']['tokens']), 1)
        token_body = body['body']['tokens'][0]
        self.assertEqual(token_body['name'], 'Editor token')
        self.assertNotIn('token', token_body)

    def test_revoke_developer_token(self):
        _, token = DeveloperTokenService.create_token(
            self.editor,
            name='MCP',
            scopes=['posts:read'],
        )
        self.client.login(username='developer', password='developer')

        response = self.client.delete(f'/v1/developer-tokens/{token.id}')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'DONE')
        self.assertIsNotNone(body['body']['revokedAt'])

        token.refresh_from_db()
        self.assertIsNotNone(token.revoked_at)

    def test_user_cannot_revoke_other_user_token(self):
        _, token = DeveloperTokenService.create_token(
            self.other_editor,
            name='Other editor token',
            scopes=['posts:read'],
        )
        self.client.login(username='developer', password='developer')

        response = self.client.delete(f'/v1/developer-tokens/{token.id}')

        self.assertEqual(response.status_code, 404)

    def test_developer_api_docs_redirects_to_generated_docs(self):
        self.client.login(username='developer', password='developer')

        response = self.client.get('/docs/developer-api')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/api/developer/v1/docs')

    def test_developer_api_docs_detail_redirects_to_generated_docs(self):
        self.client.login(username='developer', password='developer')

        response = self.client.get('/docs/developer-api/list-posts')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/api/developer/v1/docs')

    @override_settings(SITE_URL='https://blex.example')
    def test_developer_api_quickstart_renders(self):
        self.client.login(username='developer', password='developer')

        response = self.client.get('/docs/developer-api/quickstart')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('개발자 API 빠른 시작', body)
        self.assertIn('export BLEX_ORIGIN="https://blex.example"', body)
        self.assertIn('/api/developer/v1/posts', body)
        self.assertIn('expected_updated_at', body)

    def test_developer_api_openapi_schema_is_available(self):
        self.client.login(username='developer', password='developer')

        response = self.client.get('/api/developer/v1/openapi.json')

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['openapi'], '3.1.0')
        self.assertIn('/api/developer/v1/posts', body['paths'])
        security_schemes = body['components']['securitySchemes']
        self.assertIn('DeveloperBearerAuth', security_schemes)
        self.assertEqual(security_schemes['DeveloperBearerAuth']['scheme'], 'bearer')

    def test_developer_api_docs_use_local_swagger_assets(self):
        self.client.login(username='developer', password='developer')

        response = self.client.get('/api/developer/v1/docs')

        self.assertEqual(response.status_code, 200)
        body = response.content.decode()
        self.assertIn('ninja/swagger-ui-bundle.js', body)
        self.assertNotIn('cdn.jsdelivr.net', body)

    def test_developer_api_docs_require_login(self):
        paths = (
            '/docs/developer-api/quickstart',
            '/api/developer/v1/docs',
            '/api/developer/v1/openapi.json',
        )

        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 302)
                self.assertIn('/login', response['Location'])

    def test_developer_api_docs_require_editor_role(self):
        self.client.login(username='reader', password='reader')
        paths = (
            '/docs/developer-api/quickstart',
            '/api/developer/v1/docs',
            '/api/developer/v1/openapi.json',
        )

        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 302)
                self.assertEqual(response['Location'], '/')

    def test_reader_cannot_create_developer_token(self):
        self.client.login(username='reader', password='reader')

        response = self.client.post(
            '/v1/developer-tokens',
            json.dumps({'name': 'Reader', 'scopes': ['posts:read']}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['status'], 'ERROR')
        self.assertEqual(body['errorCode'], 'error:RJ')

    def test_reader_cannot_list_developer_tokens(self):
        self.client.login(username='reader', password='reader')

        response = self.client.get('/v1/developer-tokens')

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

    def test_demoted_editor_token_is_rejected(self):
        raw_token, _ = DeveloperTokenService.create_token(
            self.editor,
            name='MCP',
            scopes=['posts:read'],
        )
        profile = Profile.objects.get(user=self.editor)
        profile.role = Profile.Role.READER
        profile.save(update_fields=['role'])

        response = self.client.get(
            '/api/developer/v1/me',
            HTTP_AUTHORIZATION=f'Bearer {raw_token}',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['error']['code'], 'auth.editor_required')

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
