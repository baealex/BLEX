from unittest.mock import patch

from django.test import TestCase

from board.models import User, Tag, Profile


class TagTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        user = User.objects.create_user(
            username='test',
            password='test',
            email='test@test.com',
            first_name='test User',
        )
        Profile.objects.create(user=user, role=Profile.Role.EDITOR)

        Tag.objects.create(value='test1')
        Tag.objects.create(value='test2')
        Tag.objects.create(value='test3')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_tag_when_create_post_if_not_exists(self, mock_service):
        """게시글 생성 시 존재하지 않는 태그 자동 생성 테스트"""
        self.client.login(username='test', password='test')

        response = self.client.post('/v1/posts', {
            'title': 'test',
            'text_html': 'test',
            'is_hide': False,
            'is_advertise': False,
            'tag': 'test3,test4,test5'
        })
        self.assertEqual(response.status_code, 200)

        tags = list(Tag.objects.all().values_list('value', flat=True))
        self.assertEqual('test4' in tags, True)
        self.assertEqual('test5' in tags, True)

    def test_get_tag_list(self):
        """태그 목록 조회 테스트"""
        response = self.client.get('/v1/tags')
        self.assertEqual(response.status_code, 200)
