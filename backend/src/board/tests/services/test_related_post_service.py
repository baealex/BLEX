from datetime import timedelta
from unittest.mock import call, patch

from django.contrib.auth.models import User
from django.test import TestCase
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

    @patch('board.services.post_service.random.uniform', side_effect=[0, 0, 0])
    def test_facade_preserves_ranking_and_random_call_order(self, mock_uniform):
        posts = PostService.get_related_posts(self.reference)

        self.assertEqual(posts, [self.popular, self.overlap, self.same_author])
        self.assertEqual(
            mock_uniform.call_args_list,
            [call(-3, 3), call(-3, 3), call(-3, 3)],
        )

    @patch('board.services.related_post_service.random.uniform', side_effect=[0, 0, 0])
    def test_typed_service_preserves_direct_ranking(self, mock_uniform):
        posts = RelatedPostService.get_related_posts(self.reference)

        self.assertEqual(posts, [self.popular, self.overlap, self.same_author])
        self.assertEqual(
            mock_uniform.call_args_list,
            [call(-3, 3), call(-3, 3), call(-3, 3)],
        )

    @patch('board.services.post_service.random.uniform', return_value=0)
    def test_facade_preserves_same_author_penalty(self, mock_uniform):
        penalty_tag = Tag.objects.create(value='penalty-tag')
        reference = self.create_post(
            'Penalty Reference',
            self.author,
            timezone.now(),
            (penalty_tag,),
        )
        same_author = self.create_post(
            'Penalty Same Author',
            self.author,
            timezone.now(),
            (penalty_tag,),
        )
        other_author = self.create_post(
            'Penalty Other Author',
            self.other_author,
            timezone.now(),
            (penalty_tag,),
        )

        posts = PostService.get_related_posts(reference)

        self.assertEqual(posts, [other_author, same_author])

    @patch('board.services.post_service.random.uniform', return_value=0)
    def test_candidates_preserve_public_policy_and_api_annotations(self, mock_uniform):
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

    @patch('board.services.post_service.random.uniform', return_value=0)
    def test_facade_query_count_does_not_regress(self, mock_uniform):
        with self.assertNumQueries(3):
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

    @patch('board.services.post_service.random.uniform', return_value=0)
    def test_related_posts_keep_maximum_of_eight(self, mock_uniform):
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

    @patch('board.services.related_post_service.random.uniform', return_value=0)
    def test_popular_tag_evaluates_all_candidates_with_constant_queries(self, mock_uniform):
        candidate_count = 144
        for index in range(candidate_count):
            self.create_post(
                f'Popular Tag Candidate {index}',
                self.other_author,
                timezone.now(),
                (self.alpha,),
            )
        total_candidates = RelatedPostService.get_candidates(
            self.reference,
            [self.alpha.value],
        ).count()

        with self.assertNumQueries(3):
            posts = RelatedPostService.get_related_posts(self.reference)

        self.assertEqual(len(posts), RelatedPostService.MAX_RELATED_POSTS)
        self.assertEqual(
            mock_uniform.call_count,
            total_candidates,
        )

    def test_score_helper_boundaries_remain_stable(self):
        self.assertEqual(
            PostService._calculate_tag_score({'a', 'b', 'c', 'd'}, {'a', 'b', 'c', 'd'}),
            (10, 4),
        )
        self.assertEqual(PostService._calculate_popularity_score(6, 3), 10)
        now = timezone.now()
        self.assertEqual(PostService._calculate_recency_score(now - timedelta(days=6), now), 5)
        self.assertEqual(PostService._calculate_recency_score(now - timedelta(days=7), now), 3)
        self.assertEqual(PostService._calculate_recency_score(now - timedelta(days=30), now), 1)
        self.assertEqual(PostService._calculate_recency_score(now - timedelta(days=90), now), 0)
        self.assertEqual(
            RelatedPostService.calculate_tag_score({'a', 'b'}, {'a', 'b'}),
            (6, 2),
        )
