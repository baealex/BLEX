from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from board.models import Post, PostLikes
from board.services.post_like_service import PostLikeService, PostLikeToggleResult


class PostLikeServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username='like-author')
        cls.reader = User.objects.create_user(username='like-reader')
        cls.post = Post.objects.create(
            author=cls.author,
            title='Atomic Like',
            url='atomic-like',
            published_date=timezone.now(),
        )

    def test_toggle_creates_then_removes_one_like(self):
        liked = PostLikeService.toggle(self.post, self.reader)

        self.assertEqual(liked, PostLikeToggleResult(
            count_likes=1,
            has_liked=True,
            created=True,
        ))
        self.assertEqual(
            PostLikes.objects.filter(post=self.post, user=self.reader).count(),
            1,
        )

        unliked = PostLikeService.toggle(self.post, self.reader)

        self.assertEqual(unliked, PostLikeToggleResult(
            count_likes=0,
            has_liked=False,
            created=False,
        ))
        self.assertFalse(PostLikes.objects.filter(post=self.post, user=self.reader).exists())

    def test_create_like_treats_unique_collision_as_already_liked(self):
        PostLikes.objects.create(post=self.post, user=self.reader)

        with patch.object(PostLikes.objects, 'create', side_effect=IntegrityError):
            created = PostLikeService._create_like(self.post, self.reader)

        self.assertFalse(created)
        self.assertEqual(
            PostLikes.objects.filter(post=self.post, user=self.reader).count(),
            1,
        )

    def test_create_like_reraises_unrelated_integrity_error(self):
        with patch.object(PostLikes.objects, 'create', side_effect=IntegrityError):
            with self.assertRaises(IntegrityError):
                PostLikeService._create_like(self.post, self.reader)

    def test_database_rejects_duplicate_post_and_user(self):
        PostLikes.objects.create(post=self.post, user=self.reader)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PostLikes.objects.create(post=self.post, user=self.reader)
