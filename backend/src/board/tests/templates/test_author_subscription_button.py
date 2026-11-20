"""
작가 구독 버튼 템플릿 테스트
"""
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.utils import timezone

from board.models import AuthorSubscription, Post, PostConfig, PostContent, Profile


SUBSCRIBE_BUTTON_MARKER = 'x-data="subscribe_button('


class AuthorSubscriptionButtonTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='writer',
            email='writer@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)

        cls.reader = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.reader)

        cls.post = Post.objects.create(
            author=cls.author,
            title='Subscribe Button Post',
            url='subscribe-button-post',
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=cls.post, content_html='<p>Body</p>')
        PostConfig.objects.create(post=cls.post, hide=False)

    def setUp(self):
        self.client = Client()

    def test_author_page_shows_button_to_anonymous_visitor(self):
        """비로그인 방문자에게도 버튼을 보여주고 클릭 시 로그인을 안내한다"""
        response = self.client.get('/@writer')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, SUBSCRIBE_BUTTON_MARKER)
        self.assertContains(response, 'subscribed: false')

    def test_author_page_reflects_existing_subscription(self):
        """이미 구독한 독자에게는 구독 중 상태로 렌더링한다"""
        AuthorSubscription.objects.create(subscriber=self.reader, author=self.author)
        self.client.login(username='reader', password='testpass123')

        response = self.client.get('/@writer')

        self.assertContains(response, SUBSCRIBE_BUTTON_MARKER)
        self.assertContains(response, 'subscribed: true')

    def test_author_page_hides_button_from_owner(self):
        """작가 본인 페이지에는 구독 버튼이 없다"""
        self.client.login(username='writer', password='testpass123')

        response = self.client.get('/@writer')

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, SUBSCRIBE_BUTTON_MARKER)

    def test_reader_profile_has_no_button(self):
        """글을 쓰지 않는 독자 프로필에는 구독 버튼이 없다"""
        response = self.client.get('/@reader')

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, SUBSCRIBE_BUTTON_MARKER)

    def test_post_detail_shows_button_to_reader(self):
        """글 상세의 글 정보 영역에 구독 버튼을 보여준다"""
        self.client.login(username='reader', password='testpass123')

        response = self.client.get('/@writer/subscribe-button-post')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, SUBSCRIBE_BUTTON_MARKER)

    def test_post_detail_hides_button_from_author(self):
        """작가 본인이 자기 글을 볼 때는 구독 버튼이 없다"""
        self.client.login(username='writer', password='testpass123')

        response = self.client.get('/@writer/subscribe-button-post')

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, SUBSCRIBE_BUTTON_MARKER)
