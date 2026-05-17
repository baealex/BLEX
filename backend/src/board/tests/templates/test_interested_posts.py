"""
Interested posts page template tests.
URL: /interests
"""
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, PostLikes, Profile


class InterestedPostsTemplateTestCase(TestCase):
    """Template tests for the user's interested posts page."""

    @classmethod
    def setUpTestData(cls):
        cls.reader = User.objects.create_user(
            username='reader',
            email='reader@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)

        cls.author = User.objects.create_user(
            username='author',
            email='author@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)

        cls.other_reader = User.objects.create_user(
            username='other_reader',
            email='other-reader@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.other_reader, role=Profile.Role.READER)

        cls.first_post = cls._create_post('First Interested Post', 'first-interested-post')
        cls.second_post = cls._create_post('Second Interested Post', 'second-interested-post')
        cls.hidden_post = cls._create_post('Hidden Interested Post', 'hidden-interested-post', hide=True)
        cls.future_post = cls._create_post(
            'Future Interested Post',
            'future-interested-post',
            published_date=timezone.now() + timezone.timedelta(days=1),
        )

        PostLikes.objects.create(
            post=cls.first_post,
            user=cls.reader,
            created_date=timezone.now() - timezone.timedelta(days=1),
        )
        PostLikes.objects.create(
            post=cls.first_post,
            user=cls.other_reader,
            created_date=timezone.now() - timezone.timedelta(hours=12),
        )
        PostLikes.objects.create(
            post=cls.second_post,
            user=cls.reader,
            created_date=timezone.now(),
        )
        PostLikes.objects.create(post=cls.hidden_post, user=cls.reader)
        PostLikes.objects.create(post=cls.future_post, user=cls.reader)

    @classmethod
    def _create_post(cls, title, url, hide=False, published_date=None):
        post = Post.objects.create(
            title=title,
            url=url,
            author=cls.author,
            created_date=timezone.now(),
            published_date=published_date or timezone.now(),
        )
        PostContent.objects.create(post=post, content_html=f'<p>{title}</p>')
        PostConfig.objects.create(post=post, hide=hide, advertise=False)
        return post

    def setUp(self):
        self.client = Client()

    def test_interested_posts_requires_login(self):
        response = self.client.get(reverse('interested_posts'))

        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response['Location'])

    def test_interested_posts_renders_liked_public_posts(self):
        self.client.login(username='reader', password='testpass123')

        response = self.client.get(reverse('interested_posts'))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/posts/interested_posts.html')
        self.assertContains(response, '관심 포스트')
        self.assertContains(response, 'href=/')
        self.assertContains(response, '전체 포스트')
        self.assertContains(response, 'First Interested Post')
        self.assertContains(response, 'Second Interested Post')


    def test_interested_posts_keep_total_like_counts(self):
        self.client.login(username='reader', password='testpass123')

        response = self.client.get(reverse('interested_posts'))
        posts = {post.url: post for post in response.context['posts']}

        self.assertEqual(posts['first-interested-post'].count_likes, 2)
        self.assertTrue(posts['first-interested-post'].has_liked)
        self.assertEqual(posts['second-interested-post'].count_likes, 1)

    def test_interested_posts_filters_non_public_posts(self):
        self.client.login(username='reader', password='testpass123')

        response = self.client.get(reverse('interested_posts'))

        self.assertNotContains(response, 'Hidden Interested Post')
        self.assertNotContains(response, 'Future Interested Post')

    def test_interested_posts_order_by_interest_date(self):
        self.client.login(username='reader', password='testpass123')

        response = self.client.get(reverse('interested_posts'))
        posts = list(response.context['posts'])

        self.assertEqual(posts[0].title, 'Second Interested Post')
        self.assertEqual(posts[1].title, 'First Interested Post')
