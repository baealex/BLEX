"""
List page canonical and noindex policy tests.
"""
from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, PostLikes, Profile, Series, SiteSetting, Tag


class ListPageSEOPolicyTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='seoauthor',
            email='seoauthor@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        cls.series = Series.objects.create(
            owner=cls.author,
            name='SEO Policy Series',
            url='seo-policy-series',
            text_md='SEO policy series',
            text_html='<p>SEO policy series</p>',
            hide=False,
        )
        cls.admin = User.objects.create_user(
            username='setupadmin',
            email='setupadmin@example.com',
            password='testpass123',
            is_staff=True,
        )
        cls.tag = Tag.objects.create(value='python')

        for index in range(26):
            post = Post.objects.create(
                title=f'SEO Policy Post {index}',
                url=f'seo-policy-post-{index}',
                author=cls.author,
                series=cls.series if index < 3 else None,
                created_date=timezone.now(),
                published_date=timezone.now() - timezone.timedelta(minutes=index),
            )
            PostContent.objects.create(
                post=post,
                content_html=f'<p>SEO policy content {index}</p>',
            )
            PostConfig.objects.create(
                post=post,
                hide=False,
                advertise=False,
            )
            post.tags.add(cls.tag)

    def assert_meta_robots(self, response, content: str) -> None:
        self.assertContains(
            response,
            f'<meta name="robots" content="{content}">',
            html=True,
        )
        self.assertContains(
            response,
            f'<meta name="googlebot" content="{content}">',
            html=True,
        )

    def assert_canonical(self, response, href: str) -> None:
        self.assertContains(
            response,
            f'<link rel="canonical" href="{href}">',
            html=True,
        )

    def assert_previous_page(self, response, href: str) -> None:
        self.assertContains(
            response,
            f'<link rel="prev" href="{href}">',
            html=True,
        )

    def assert_next_page(self, response, href: str) -> None:
        self.assertContains(
            response,
            f'<link rel="next" href="{href}">',
            html=True,
        )

    def test_index_first_page_uses_clean_canonical_and_next_link(self):
        """메인 목록 첫 페이지는 clean canonical과 다음 페이지 discovery를 제공한다."""
        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assert_canonical(response, 'http://localhost:8000/')
        self.assert_next_page(response, 'http://localhost:8000/?page=2')
        self.assertNotContains(response, 'content="noindex,follow"')

    def test_index_page_two_uses_self_canonical_and_previous_link(self):
        """메인 목록 페이지네이션은 page 쿼리만 보존한 self-canonical을 사용한다."""
        response = self.client.get(reverse('index') + '?page=2')

        self.assertEqual(response.status_code, 200)
        self.assert_canonical(response, 'http://localhost:8000/?page=2')
        self.assert_previous_page(response, 'http://localhost:8000/')
        self.assertNotContains(response, 'content="noindex,follow"')

    def test_index_unknown_query_is_noindex_and_canonicalizes_to_home(self):
        """메인 목록의 비표준 쿼리 조합은 색인하지 않고 홈으로 canonical을 모은다."""
        response = self.client.get(reverse('index') + '?sort=popular&page=2')

        self.assertEqual(response.status_code, 200)
        self.assert_meta_robots(response, 'noindex,follow')
        self.assert_canonical(response, 'http://localhost:8000/')

    def test_search_page_is_noindex(self):
        """검색 화면은 검색어 조합이 색인되지 않도록 noindex로 둔다."""
        response = self.client.get(reverse('search') + '?q=python')

        self.assertEqual(response.status_code, 200)
        self.assert_meta_robots(response, 'noindex,follow')
        self.assert_canonical(response, 'http://localhost:8000/search')

    def test_author_profile_and_posts_use_canonical_policy(self):
        """작성자 대표 페이지는 canonical을 갖고, 작성자 글 필터는 noindex로 둔다."""
        profile_response = self.client.get(reverse(
            'user_profile',
            kwargs={'username': self.author.username},
        ))
        self.assertEqual(profile_response.status_code, 200)
        self.assert_canonical(profile_response, 'http://localhost:8000/@seoauthor')

        posts_response = self.client.get(
            reverse('user_posts', kwargs={'username': self.author.username}) + '?tag=python'
        )
        self.assertEqual(posts_response.status_code, 200)
        self.assert_meta_robots(posts_response, 'noindex,follow')
        self.assert_canonical(posts_response, 'http://localhost:8000/@seoauthor/posts')

    def test_author_series_uses_canonical_policy(self):
        """작성자 시리즈 기본 목록은 canonical, 정렬 조합은 noindex로 둔다."""
        series_response = self.client.get(
            reverse('user_series', kwargs={'username': self.author.username})
        )
        self.assertEqual(series_response.status_code, 200)
        self.assert_canonical(series_response, 'http://localhost:8000/@seoauthor/series')

        sorted_response = self.client.get(
            reverse('user_series', kwargs={'username': self.author.username}) + '?sort=newest'
        )
        self.assertEqual(sorted_response.status_code, 200)
        self.assert_meta_robots(sorted_response, 'noindex,follow')
        self.assert_canonical(sorted_response, 'http://localhost:8000/@seoauthor/series')

    def test_author_posts_page_two_uses_paginated_canonical(self):
        """작성자 글 목록 페이지네이션은 page 쿼리만 canonical에 남긴다."""
        response = self.client.get(
            reverse('user_posts', kwargs={'username': self.author.username}) + '?page=2'
        )

        self.assertEqual(response.status_code, 200)
        self.assert_canonical(response, 'http://localhost:8000/@seoauthor/posts?page=2')
        self.assert_previous_page(response, 'http://localhost:8000/@seoauthor/posts')

    def test_tag_pages_use_noindex_for_sort_and_paginated_canonical_for_detail(self):
        """태그 정렬 조합은 noindex, 태그 상세 페이지네이션은 self-canonical을 사용한다."""
        list_response = self.client.get(reverse('tag_list') + '?sort=name')
        self.assertEqual(list_response.status_code, 200)
        self.assert_meta_robots(list_response, 'noindex,follow')
        self.assert_canonical(list_response, 'http://localhost:8000/tags')

        detail_response = self.client.get(
            reverse('tag_detail', kwargs={'name': self.tag.value}) + '?page=2'
        )
        self.assertEqual(detail_response.status_code, 200)
        self.assert_canonical(detail_response, 'http://localhost:8000/tag/python?page=2')
        self.assert_previous_page(detail_response, 'http://localhost:8000/tag/python')

    def test_list_pages_noindex_unexpected_query_parameters(self):
        """목록 화면의 허용되지 않은 쿼리는 색인하지 않고 기본 URL로 모은다."""
        cases = [
            (
                reverse('user_posts', kwargs={'username': self.author.username}) + '?foo=bar',
                'http://localhost:8000/@seoauthor/posts',
            ),
            (
                reverse('user_series', kwargs={'username': self.author.username}) + '?utm=campaign',
                'http://localhost:8000/@seoauthor/series',
            ),
            (
                reverse('tag_list') + '?foo=bar',
                'http://localhost:8000/tags',
            ),
            (
                reverse('tag_detail', kwargs={'name': self.tag.value}) + '?sort=name',
                'http://localhost:8000/tag/python',
            ),
        ]

        for path, canonical_url in cases:
            with self.subTest(path=path):
                response = self.client.get(path)

                self.assertEqual(response.status_code, 200)
                self.assert_meta_robots(response, 'noindex,follow')
                self.assert_canonical(response, canonical_url)

    def test_private_interested_posts_are_noindex_nofollow(self):
        """개인화된 관심 목록은 공개 색인 대상이 아니다."""
        PostLikes.objects.create(user=self.author, post=Post.objects.first())
        self.client.login(username='seoauthor', password='testpass123')

        response = self.client.get(reverse('interested_posts'))

        self.assertEqual(response.status_code, 200)
        self.assert_meta_robots(response, 'noindex,nofollow')
        self.assertNotIn('page_canonical_url', response.context)

    def test_seo_disabled_overrides_page_specific_noindex_policy(self):
        """SEO OFF는 페이지별 noindex,follow보다 강한 noindex,nofollow를 사용한다."""
        setting = SiteSetting.get_instance()
        setting.seo_enabled = False
        setting.save(update_fields=['seo_enabled'])

        response = self.client.get(reverse('search') + '?q=python')

        self.assertEqual(response.status_code, 200)
        self.assert_meta_robots(response, 'noindex,nofollow')
        self.assertEqual(response['X-Robots-Tag'], 'noindex, nofollow')
