from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from board.models import Post, PostConfig, Series
from board.services.public_post_service import PublicPostService


class PublicPostServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='public-post-helper-author',
            email='public-post-helper@example.com',
            password='password123',
        )
        cls.series = Series.objects.create(
            owner=cls.author,
            name='Public Helper Series',
            url='public-helper-series',
            hide=False,
        )
        now = timezone.now()
        cls.public_post = cls.create_post('Public Post', 'public-post', now)
        cls.create_post('Draft Post', 'draft-post', None)
        cls.create_post('Future Post', 'future-post', now + timedelta(days=1))
        cls.create_post('Hidden Post', 'hidden-post', now, hide=True)

    @classmethod
    def create_post(cls, title: str, url: str, published_date, hide: bool = False) -> Post:
        post = Post.objects.create(
            title=title,
            url=url,
            author=cls.author,
            published_date=published_date,
            series=cls.series,
        )
        PostConfig.objects.create(post=post, hide=hide, advertise=False)
        return post

    def test_filter_public_posts_excludes_drafts_future_posts_and_hidden_posts(self):
        """공개 글 필터는 임시저장, 미래 발행, 숨김 글을 제외한다."""
        posts = PublicPostService.filter_public_posts(Post.objects).order_by('url')

        self.assertEqual(list(posts), [self.public_post])

    def test_is_public_matches_public_post_rules(self):
        """단일 포스트 공개 여부 검사도 공개 글 필터와 같은 기준을 따른다."""
        self.assertTrue(PublicPostService.is_public(self.public_post))
        self.assertFalse(PublicPostService.is_public(Post.objects.get(url='draft-post')))
        self.assertFalse(PublicPostService.is_public(Post.objects.get(url='future-post')))
        self.assertFalse(PublicPostService.is_public(Post.objects.get(url='hidden-post')))

    def test_build_public_filter_supports_related_post_prefix(self):
        """관계 prefix를 지정하면 공개 글이 있는 부모 객체를 안전하게 필터링한다."""
        series = Series.objects.filter(
            PublicPostService.build_public_filter('posts'),
        ).distinct()

        self.assertEqual(list(series), [self.series])
