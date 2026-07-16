from django.test import Client, TestCase
from django.contrib.auth.models import User
from django.db import connection
from django.test.utils import CaptureQueriesContext
from board.models import Form, Profile


class FormTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass')
        Profile.objects.create(user=self.user, role=Profile.Role.EDITOR)
        self.form = Form.objects.create(
            user=self.user, title='Test Form', content='Test Content')

    def test_forms_list(self):
        """폼 목록 조회 테스트"""
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

    def test_forms_list_does_not_load_form_content(self):
        """폼 목록은 본문 필드를 데이터베이스에서 읽지 않는다."""
        self.client.login(username='testuser', password='testpass')

        with CaptureQueriesContext(connection) as queries:
            response = self.client.get('/v1/forms')

        self.assertEqual(response.status_code, 200)
        form_queries = [
            query['sql']
            for query in queries.captured_queries
            if 'FROM "board_form"' in query['sql']
        ]
        self.assertEqual(len(form_queries), 1)
        selected_columns = form_queries[0].split(' FROM ')[0]
        self.assertNotIn('"board_form"."content"', selected_columns)

    def test_forms_detail(self):
        """폼 상세 조회, 수정, 삭제 테스트"""
        # 로그인하지 않은 경우
        response = self.client.get(f'/v1/forms/{self.form.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ERROR')

        # 다른 유저로 로그인한 경우
        other_user = User.objects.create_user(
            username='otheruser', password='otherpass')
        Profile.objects.create(user=other_user, role=Profile.Role.EDITOR)
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
        """폼 생성 테스트"""
        self.client.login(username='testuser', password='testpass')
        response = self.client.post('/v1/forms', {
            'title': 'New Title',
            'content': 'New Content'
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'DONE')
        self.assertTrue(Form.objects.filter(
            id=response.json()['body']['id']).exists())

    def test_create_form_requires_csrf_token_when_enforced(self):
        """세션 기반 서식 생성 API는 CSRF 토큰을 요구한다."""
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.login(username='testuser', password='testpass')

        response = csrf_client.post('/v1/forms', {
            'title': 'New Title',
            'content': 'New Content',
        })

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Form.objects.filter(title='New Title').exists())
