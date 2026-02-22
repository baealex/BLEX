from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from board.models import Post, PostConfig
from board.services.post_service import PostService


class PostNotificationServiceTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='notify-author',
            email='notify-author@example.com',
            password='testpass123'
        )

    @patch('board.services.post_service.WebhookService.notify_channels')
    def test_send_notifications_on_commit_for_published_post(self, mock_notify):
        post = Post.objects.create(
            author=self.user,
            title='Published Post',
            url='published-post',
            published_date=timezone.now(),
        )
        post_config = PostConfig.objects.create(post=post, hide=False)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            PostService.send_post_notifications(post, post_config)

        self.assertEqual(len(callbacks), 1)
        mock_notify.assert_not_called()

        callbacks[0]()
        mock_notify.assert_called_once_with(post, post_config)

    @patch('board.services.post_service.WebhookService.notify_channels')
    def test_skip_notifications_for_hidden_post(self, mock_notify):
        post = Post.objects.create(
            author=self.user,
            title='Hidden Post',
            url='hidden-post',
            published_date=timezone.now(),
        )
        post_config = PostConfig.objects.create(post=post, hide=True)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            PostService.send_post_notifications(post, post_config)

        self.assertEqual(len(callbacks), 0)
        mock_notify.assert_not_called()

    @patch('board.services.post_service.WebhookService.notify_channels')
    def test_skip_notifications_for_draft_post(self, mock_notify):
        post = Post.objects.create(
            author=self.user,
            title='Draft Post',
            url='draft-post',
            published_date=None,
        )
        post_config = PostConfig.objects.create(post=post, hide=False)

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            PostService.send_post_notifications(post, post_config)

        self.assertEqual(len(callbacks), 0)
        mock_notify.assert_not_called()
