from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from board.models import Post
from board.services.post_status_service import PostStatusService


class PostStatusServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='post-status-author',
            email='post-status@example.com',
            password='password123',
        )
        now = timezone.now()
        cls.draft = Post.objects.create(
            title='Draft Post',
            url='draft-post',
            author=cls.author,
            published_date=None,
        )
        cls.published = Post.objects.create(
            title='Published Post',
            url='published-post',
            author=cls.author,
            published_date=now,
        )
        cls.scheduled = Post.objects.create(
            title='Scheduled Post',
            url='scheduled-post',
            author=cls.author,
            published_date=now + timedelta(days=1),
        )

    def test_status_predicates_match_published_date(self):
        self.assertTrue(PostStatusService.is_draft(self.draft))
        self.assertFalse(PostStatusService.is_published(self.draft))
        self.assertFalse(PostStatusService.is_scheduled(self.draft))

        self.assertFalse(PostStatusService.is_draft(self.published))
        self.assertTrue(PostStatusService.is_published(self.published))
        self.assertFalse(PostStatusService.is_scheduled(self.published))

        self.assertFalse(PostStatusService.is_draft(self.scheduled))
        self.assertFalse(PostStatusService.is_published(self.scheduled))
        self.assertTrue(PostStatusService.is_scheduled(self.scheduled))

    def test_status_filters_match_predicates(self):
        self.assertEqual(list(PostStatusService.filter_drafts(Post.objects)), [self.draft])
        self.assertEqual(list(PostStatusService.filter_published(Post.objects)), [self.published])
        self.assertEqual(list(PostStatusService.filter_scheduled(Post.objects)), [self.scheduled])

    def test_post_model_status_methods_delegate_to_same_policy(self):
        self.assertTrue(self.draft.is_draft())
        self.assertFalse(self.draft.is_published())
        self.assertFalse(self.published.is_draft())
        self.assertTrue(self.published.is_published())
