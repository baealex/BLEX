from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from board.models import Form


class FormTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass')
        self.form = Form.objects.create(
            user=self.user, title='Test Form', content='Test Content')

    def test_forms_list(self):
        # 로그인하지 않은 경우
        response = self.client.get('/v1/forms')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ERROR')

        # 로그인한 경우
        self.client.login(username='testuser', password='testpass')
        response = self.client.get('/v1/forms')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertEqual(len(response.json()['body']['forms']), 1)

    def test_forms_detail(self):
        # 로그인하지 않은 경우
        response = self.client.get(f'/v1/forms/{self.form.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ERROR')

        # 다른 유저로 로그인한 경우
        other_user = User.objects.create_user(
            username='otheruser', password='otherpass')
        self.client.login(username='otheruser', password='otherpass')
        response = self.client.get(f'/v1/forms/{self.form.id}')
        self.assertEqual(response.status_code, 404)

        # 로그인한 경우
        self.client.login(username='testuser', password='testpass')
        response = self.client.get(f'/v1/forms/{self.form.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertEqual(response.json()['body']['title'], 'Test Form')
        self.assertEqual(response.json()['body']['content'], 'Test Content')

        response = self.client.put(f'/v1/forms/{self.form.id}',
                                   data='title=New Title&content=New Content'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')

        self.form.refresh_from_db()
        self.assertEqual(self.form.title, 'New Title')
        self.assertEqual(self.form.content, 'New Content')

        response = self.client.delete(f'/v1/forms/{self.form.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertFalse(Form.objects.filter(id=self.form.id).exists())

    def test_create_form(self):
        self.client.login(username='testuser', password='testpass')
        response = self.client.post('/v1/forms', {
            'title': 'New Title',
            'content': 'New Content'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertTrue(Form.objects.filter(
            id=response.json()['body']['id']).exists())
