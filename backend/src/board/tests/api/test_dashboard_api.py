import json
from unittest.mock import patch

from django.test import TestCase
from django.core.cache import cache

from board.models import (
    User, Config, Post, PostContent, PostConfig,
    Profile, Comment, PostLikes
)


class DashboardAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create test user
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

        # Create another user for interactions
        cls.other_user = User.objects.create_user(
            username='otheruser',
            password='testpass',
            email='other@test.com',
        )
        Profile.objects.create(user=cls.other_user, role=Profile.Role.READER)
        Config.objects.create(user=cls.other_user)

        # Create test posts
        for i in range(5):
            post = Post.objects.create(
                url=f'test-post-{i}',
                title=f'Test Post {i}',
                author=cls.user,
            )
            PostContent.objects.create(
                post=post,
                text_md=f'# Test Post {i}',
                text_html=f'<h1>Test Post {i}</h1>'
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )

        # Create some comments
        post = Post.objects.get(url='test-post-0')
        Comment.objects.create(
            post=post,
            author=cls.other_user,
            text_md='Great post!',
            text_html='<p>Great post!</p>',
        )

        # Create some likes
        PostLikes.objects.create(
            post=post,
            user=cls.other_user
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
        # Clear cache before each test
        cache.clear()

    def tearDown(self):
        # Clear cache after each test
        cache.clear()

    def test_dashboard_activities_requires_login(self):
        """대시보드 활동 조회는 로그인 필요"""
        response = self.client.get('/v1/dashboard/activities')
        # Should redirect to login or return error
        self.assertIn(response.status_code, [302, 403])

    def test_dashboard_activities_authenticated_user(self):
        """로그인한 사용자의 대시보드 활동 조회"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = [
                {
                    'type': 'post',
                    'title': 'Test Post 0',
                    'date': '2024-01-01'
                }
            ]

            response = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self.assertIn('recentActivities', content['body'])

    def test_dashboard_activities_caching(self):
        """대시보드 활동 결과 캐싱 확인"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_activities = [
                {'type': 'post', 'title': 'Test', 'date': '2024-01-01'}
            ]
            mock_service.return_value = mock_activities

            # First request - should call service
            response1 = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response1.status_code, 200)
            self.assertEqual(mock_service.call_count, 1)

            # Second request - should use cache
            response2 = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response2.status_code, 200)
            # Service should still be called only once
            self.assertEqual(mock_service.call_count, 1)

            # Responses should be identical
            content1 = json.loads(response1.content)
            content2 = json.loads(response2.content)
            self.assertEqual(content1, content2)

    def test_dashboard_activities_invalid_method(self):
        """GET 이외의 메서드는 허용되지 않음"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/dashboard/activities', {})
        self.assertEqual(response.status_code, 404)

        response = self.client.put('/v1/dashboard/activities', {})
        self.assertEqual(response.status_code, 404)

    def test_dashboard_activities_response_structure(self):
        """대시보드 활동 응답 구조 확인"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = [
                {
                    'type': 'post',
                    'title': 'Test Post',
                    'url': 'test-post',
                    'date': '2024-01-01',
                    'count': 1
                }
            ]

            response = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)

            self.assertIn('body', content)
            self.assertIn('recentActivities', content['body'])
            self.assertIsInstance(content['body']['recentActivities'], list)

    def test_dashboard_activities_with_days_parameter(self):
        """기간 파라미터와 함께 활동 조회"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = []

            response = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response.status_code, 200)

            # Verify service was called with correct days parameter (default 30)
            mock_service.assert_called_once()
            call_args = mock_service.call_args
            self.assertEqual(call_args[1].get('days', 30), 30)

    def test_dashboard_activities_empty_activities(self):
        """활동 내역이 없는 경우"""
        # Create a new user with no activities
        new_user = User.objects.create_user(
            username='newuser',
            password='testpass',
            email='new@test.com',
        )
        Profile.objects.create(user=new_user, role=Profile.Role.READER)
        Config.objects.create(user=new_user)

        self.client.login(username='newuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = []

            response = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)
            self.assertEqual(len(content['body']['recentActivities']), 0)

    def test_dashboard_activities_multiple_activity_types(self):
        """다양한 활동 유형 반환 확인"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = [
                {'type': 'post', 'title': 'New Post', 'date': '2024-01-01'},
                {'type': 'comment', 'content': 'New Comment', 'date': '2024-01-02'},
                {'type': 'like', 'post_title': 'Liked Post', 'date': '2024-01-03'},
            ]

            response = self.client.get('/v1/dashboard/activities')
            self.assertEqual(response.status_code, 200)
            content = json.loads(response.content)

            activities = content['body']['recentActivities']
            self.assertEqual(len(activities), 3)

            # Verify different activity types are present
            activity_types = [activity['type'] for activity in activities]
            self.assertIn('post', activity_types)
            self.assertIn('comment', activity_types)
            self.assertIn('like', activity_types)

    def test_dashboard_activities_cache_expiration(self):
        """캐시 만료 시간 확인 (2분)"""
        self.client.login(username='testuser', password='testpass')

        with patch('board.services.UserService.get_user_dashboard_activities') as mock_service:
            mock_service.return_value = []

            # First request
            self.client.get('/v1/dashboard/activities')

            # Check cache was set
            cache_key = f'dashboard_activities_{self.user.id}'
            cached_value = cache.get(cache_key)
            self.assertIsNotNone(cached_value)

            # Clear cache to simulate expiration
            cache.clear()

            # Second request after cache expiration
            self.client.get('/v1/dashboard/activities')

            # Service should be called again
            self.assertEqual(mock_service.call_count, 2)
