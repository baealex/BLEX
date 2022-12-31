import json

from unittest.mock import patch

from django.test import TestCase

from board.models import User, Profile, Config
from modules import oauth


class AuthTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='Test User',
        )

        Profile.objects.create(
            user=User.objects.get(username='test'),
        )

        Config.objects.create(
            user=User.objects.get(username='test'),
        )

    def test_login_unsigned(self):
        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_login(self):
        response = self.client.post('/v1/login', {
            'username': 'test',
            'password': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test')

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test')

    def test_logout(self):
        self.client.login(username='test', password='test')

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/logout')
        self.assertEqual(response.status_code, 200)

        response = self.client.get('/v1/login')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_create_account(self):
        response = self.client.post('/v1/sign', {
            'username': 'test2',
            'password': 'test2',
            'name': 'Test User 2',
            'email': 'test2@test.com'
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/login', {
            'username': 'test2',
            'password': 'test2',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test2')

    def test_delete_account(self):
        self.client.login(username='test', password='test')

        response = self.client.delete('/v1/sign')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        response = self.client.post('/v1/login', {
            'username': 'test',
            'password': 'test',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @patch('modules.oauth.auth_github', return_value=oauth.State(success=True, user={
        'node_id': 'SECRET_TOKEN_VALUE',
        'login': 'test3',
        'name': 'Test User 3',
    }))
    def test_create_account_from_github(self, mock_servuce):
        response = self.client.post('/v1/sign/github', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)

        self.client.logout()

        response = self.client.post('/v1/sign/github', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], False)

    @patch('modules.oauth.auth_google', return_value=oauth.State(success=True, user={
        'id': 'SECRET_TOKEN_VALUE',
        'email': 'test3@google.com',
        'name': 'Test User 3',
    }))
    def test_create_account_from_google(self, mock_servuce):
        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], True)

        self.client.logout()

        response = self.client.post('/v1/sign/google', {
            'code': 'SECRET_TOKEN_VALUE',
        })
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['username'], 'test3')
        self.assertEqual(content['body']['isFirstLogin'], False)
