from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from board.models import Config, PinnedPost, Post, PostConfig, Profile, User
from board.modules.response import ErrorCode
from board.services.pinned_post_service import PinnedPostError, PinnedPostService


class PinnedPostIntegrityTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='pinned-integrity')
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)
        cls.posts = []
        for index in range(2):
            post = Post.objects.create(
                author=cls.user,
                title=f'Pinned Integrity {index}',
                url=f'pinned-integrity-{index}',
                published_date=timezone.now(),
            )
            PostConfig.objects.create(post=post)
            cls.posts.append(post)

    def test_add_pinned_post_locks_user_mutation_boundary(self):
        with patch.object(
            User.objects,
            'select_for_update',
            wraps=User.objects.select_for_update,
        ) as select_for_update:
            pinned_post = PinnedPostService.add_pinned_post(
                self.user,
                self.posts[0].url,
            )

        select_for_update.assert_called_once_with()
        self.assertEqual(pinned_post.order, 0)

    def test_unique_collision_maps_to_existing_pinned_post_error(self):
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        with patch.object(PinnedPost.objects, 'create', side_effect=IntegrityError):
            with self.assertRaises(PinnedPostError) as raised:
                PinnedPostService._create_pinned_post(
                    self.user,
                    self.posts[0],
                    1,
                )

        self.assertEqual(raised.exception.code, ErrorCode.REJECT)
        self.assertEqual(raised.exception.message, '이미 고정된 글입니다.')

    def test_unrelated_integrity_error_is_reraised(self):
        with patch.object(PinnedPost.objects, 'create', side_effect=IntegrityError):
            with self.assertRaises(IntegrityError):
                PinnedPostService._create_pinned_post(
                    self.user,
                    self.posts[0],
                    0,
                )

    def test_database_rejects_duplicate_user_and_post(self):
        PinnedPost.objects.create(user=self.user, post=self.posts[0], order=0)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PinnedPost.objects.create(user=self.user, post=self.posts[0], order=1)
