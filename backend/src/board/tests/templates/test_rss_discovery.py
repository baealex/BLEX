"""
RSS auto-discovery template tests.
"""
from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Profile, SiteSetting


@override_settings(SITE_URL='http://localhost:8000')
class RSSDiscoveryTemplateTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='rssauthor',
            email='rssauthor@example.com',
            password='testpass123',
        )
        User.objects.create_user(
            username='setupadmin',
            email='setupadmin@example.com',
            password='testpass123',
            is_staff=True,
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        cls.post = Post.objects.create(
            title='RSS Discovery Post',
            url='rss-discovery-post',
            author=cls.author,
            created_date=timezone.now(),
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=cls.post,
            content_html='<p>RSS discovery content</p>',
        )
        PostConfig.objects.create(
            post=cls.post,
            hide=False,
        )

    def assert_rss_alternate(self, response, title: str, href: str) -> None:
        self.assertContains(
            response,
            f'<link rel="alternate" type="application/rss+xml" title="{title}" href="{href}">',
            html=True,
        )

    def test_index_advertises_site_rss_alternate(self):
        """메인 페이지는 사이트 RSS feed를 자동 발견 링크로 노출한다."""
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assert_rss_alternate(response, 'BLEX RSS', 'http://localhost:8000/rss')
        self.assertEqual(response.content.decode().count('application/rss+xml'), 1)

    def test_public_author_pages_advertise_author_rss_alternate(self):
        """공개 작성자 페이지는 사이트 RSS와 작성자 RSS를 함께 노출한다."""
        urls = [
            reverse('user_profile', kwargs={'username': self.author.username}),
            reverse('user_posts', kwargs={'username': self.author.username}),
            reverse('user_series', kwargs={'username': self.author.username}),
        ]

        for url in urls:
            with self.subTest(url=url):
                response = self.client.get(url)

                self.assertEqual(response.status_code, 200)
                self.assert_rss_alternate(response, 'BLEX RSS', 'http://localhost:8000/rss')
                self.assert_rss_alternate(
                    response,
                    'rssauthor RSS',
                    'http://localhost:8000/rss/@rssauthor',
                )
                self.assertEqual(response.content.decode().count('application/rss+xml'), 2)

    def test_post_detail_advertises_author_rss_alternate(self):
        """글 상세 페이지는 사이트 RSS와 글 작성자 RSS를 함께 노출한다."""
        response = self.client.get(reverse(
            'post_detail',
            kwargs={
                'username': self.author.username,
                'post_url': self.post.url,
            },
        ))

        self.assertEqual(response.status_code, 200)
        self.assert_rss_alternate(response, 'BLEX RSS', 'http://localhost:8000/rss')
        self.assert_rss_alternate(
            response,
            'rssauthor RSS',
            'http://localhost:8000/rss/@rssauthor',
        )

    @override_settings(SITE_URL='https://blex.example')
    def test_rss_alternate_links_use_configured_site_url(self):
        """RSS 자동 발견 링크는 configured SITE_URL origin을 사용한다."""
        response = self.client.get(reverse(
            'post_detail',
            kwargs={
                'username': self.author.username,
                'post_url': self.post.url,
            },
        ))

        self.assertEqual(response.status_code, 200)
        self.assert_rss_alternate(response, 'BLEX RSS', 'https://blex.example/rss')
        self.assert_rss_alternate(
            response,
            'rssauthor RSS',
            'https://blex.example/rss/@rssauthor',
        )

    def test_rss_alternate_links_are_omitted_when_seo_disabled(self):
        """SEO가 꺼져 있으면 HTML에서 RSS 자동 발견 링크를 숨긴다."""
        setting = SiteSetting.get_instance()
        setting.seo_enabled = False
        setting.save(update_fields=['seo_enabled'])

        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'application/rss+xml')
