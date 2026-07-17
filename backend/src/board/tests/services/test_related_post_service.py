from datetime import timedelta

from django.contrib.auth.models import User
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from board.models import Post, PostConfig, PostLikes, Profile, Tag
from board.services.post_service import PostService
from board.services.related_post_service import RelatedPostService


class RelatedPostServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username='related-author')
        cls.other_author = User.objects.create_user(username='related-other')
        Profile.objects.create(user=cls.author)
        Profile.objects.create(user=cls.other_author)
        cls.likers = [
            User.objects.create_user(username=f'related-liker-{index}')
            for index in range(5)
        ]

        cls.alpha = Tag.objects.create(value='alpha')
        cls.beta = Tag.objects.create(value='beta')
        cls.gamma = Tag.objects.create(value='gamma')
        cls.delta = Tag.objects.create(value='delta')
        now = timezone.now()

        cls.reference = cls.create_post(
            'Reference',
            cls.author,
            now,
            (cls.alpha, cls.beta, cls.gamma),
        )
        cls.popular = cls.create_post(
            'Popular',
            cls.other_author,
            now - timedelta(days=40),
            (cls.alpha,),
        )
        for liker in cls.likers:
            PostLikes.objects.create(post=cls.popular, user=liker)

        cls.overlap = cls.create_post(
            'Overlap',
            cls.other_author,
            now - timedelta(days=10),
            (cls.alpha, cls.beta, cls.gamma),
        )
        cls.same_author = cls.create_post(
            'Same Author',
            cls.author,
            now,
            (cls.alpha, cls.beta),
        )
        cls.create_post(
            'Hidden',
            cls.other_author,
            now,
            (cls.alpha, cls.beta, cls.gamma),
            hide=True,
        )
        cls.create_post(
            'Draft',
            cls.other_author,
            None,
            (cls.alpha, cls.beta, cls.gamma),
        )
        cls.create_post(
            'Scheduled',
            cls.other_author,
            now + timedelta(days=1),
            (cls.alpha, cls.beta, cls.gamma),
        )
        cls.create_post(
            'Unrelated',
            cls.other_author,
            now,
            (cls.delta,),
        )

    @classmethod
    def create_post(
        cls,
        title: str,
        author: User,
        published_date,
        tags: tuple[Tag, ...],
        *,
        hide: bool = False,
    ) -> Post:
        post = Post.objects.create(
            title=title,
            url=title.lower().replace(' ', '-'),
            author=author,
            published_date=published_date,
        )
        PostConfig.objects.create(post=post, hide=hide)
        post.tags.add(*tags)
        return post

    def test_facade_prioritizes_tag_relevance_deterministically(self):
        first_result = PostService.get_related_posts(self.reference)
        second_result = PostService.get_related_posts(self.reference)
        legacy_keyword_result = RelatedPostService.get_related_posts(
            self.reference,
            jitter=lambda lower, upper: upper,
        )

        expected = [self.overlap, self.same_author, self.popular]
        self.assertEqual(first_result, expected)
        self.assertEqual(second_result, expected)
        self.assertEqual(legacy_keyword_result, expected)

    def test_equal_relevance_prefers_another_author(self):
        diversity_tag = Tag.objects.create(value='diversity-tag')
        published_date = timezone.now()
        reference = self.create_post(
            'Diversity Reference',
            self.author,
            published_date,
            (diversity_tag,),
        )
        same_author = self.create_post(
            'Diversity Same Author',
            self.author,
            published_date,
            (diversity_tag,),
        )
        other_author = self.create_post(
            'Diversity Other Author',
            self.other_author,
            published_date,
            (diversity_tag,),
        )

        posts = PostService.get_related_posts(reference)

        self.assertEqual(posts, [other_author, same_author])

    def test_focused_tag_match_wins_when_overlap_is_equal(self):
        published_date = timezone.now()
        reference = self.create_post(
            'Focused Reference',
            self.author,
            published_date,
            (self.alpha, self.beta),
        )
        focused = self.create_post(
            'Focused Candidate',
            self.other_author,
            published_date,
            (self.alpha, self.beta),
        )
        broad = self.create_post(
            'Broad Candidate',
            self.other_author,
            published_date,
            (self.alpha, self.beta, self.gamma, self.delta),
        )

        posts = PostService.get_related_posts(reference)

        self.assertLess(posts.index(focused), posts.index(broad))

    def test_candidates_preserve_public_policy_and_api_annotations(self):
        posts = PostService.get_related_posts(self.reference)

        self.assertEqual({post.url for post in posts}, {
            'popular',
            'overlap',
            'same-author',
        })
        popular = next(post for post in posts if post.url == 'popular')
        self.assertEqual(popular.author_username, 'related-other')
        self.assertEqual(popular.author_name, '')
        self.assertEqual(str(popular.author_image), '')
        self.assertEqual(popular.likes_count, 5)
        self.assertEqual(popular.comments_count, 0)
        self.assertEqual(popular.candidate_tag_overlap, 1)
        self.assertEqual(popular.tag_score, 3)

    def test_facade_query_count_does_not_regress(self):
        with self.assertNumQueries(2):
            posts = PostService.get_related_posts(self.reference)

        self.assertEqual(len(posts), 3)

    def test_post_without_tags_returns_empty_with_single_query(self):
        post = self.create_post(
            'No Tags',
            self.author,
            timezone.now(),
            (),
        )

        with self.assertNumQueries(1):
            posts = PostService.get_related_posts(post)

        self.assertEqual(posts, [])

    def test_related_posts_keep_maximum_of_eight(self):
        for index in range(8):
            self.create_post(
                f'Additional {index}',
                self.other_author,
                timezone.now(),
                (self.alpha,),
            )

        posts = PostService.get_related_posts(self.reference)

        self.assertEqual(len(posts), 8)
        self.assertNotIn(self.reference, posts)

    def test_popular_tag_limits_rows_in_the_database(self):
        for index in range(144):
            self.create_post(
                f'Popular Tag Candidate {index}',
                self.other_author,
                timezone.now(),
                (self.alpha,),
            )

        with CaptureQueriesContext(connection) as captured:
            posts = RelatedPostService.get_related_posts(self.reference)

        self.assertEqual(len(captured), 2)
        self.assertEqual(len(posts), RelatedPostService.MAX_RELATED_POSTS)
        self.assertIn(
            f'LIMIT {RelatedPostService.MAX_RELATED_POSTS}',
            captured[-1]['sql'].upper(),
        )

    def test_score_helper_boundaries_remain_stable(self):
        self.assertEqual(
            RelatedPostService.calculate_tag_score(
                {'a', 'b', 'c', 'd'},
                {'a', 'b', 'c', 'd'},
            ),
            (10, 4),
        )
        self.assertEqual(RelatedPostService.calculate_popularity_score(6, 3), 10)
        now = timezone.now()
        self.assertEqual(
            RelatedPostService.calculate_recency_score(
                now - timedelta(days=6),
                now,
            ),
            5,
        )
        self.assertEqual(
            RelatedPostService.calculate_recency_score(
                now - timedelta(days=7),
                now,
            ),
            3,
        )
        self.assertEqual(
            RelatedPostService.calculate_recency_score(
                now - timedelta(days=30),
                now,
            ),
            1,
        )
        self.assertEqual(
            RelatedPostService.calculate_recency_score(
                now - timedelta(days=90),
                now,
            ),
            0,
        )
