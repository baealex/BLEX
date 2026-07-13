import json
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import Config, Post, PostConfig, PostContent, Profile, User


class PostLikeActionTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username='action-author')
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        cls.author_config = Config.objects.create(user=cls.author)
        cls.reader = User.objects.create_user(username='action-reader')
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)
        Config.objects.create(user=cls.reader)
        cls.post = Post.objects.create(
            author=cls.author,
            title='Like Action',
            url='like-action',
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=cls.post, content_html='<p>like</p>')
        PostConfig.objects.create(post=cls.post)

    def setUp(self):
        self.client.force_login(self.reader)

    @patch('board.views.post_actions.create_notify')
    def test_like_notifies_author_when_notification_setting_is_enabled(self, mock_notify):
        self.author_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE, 'true')

        response = self.client.post('/like/like-action')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {
            'status': 'done',
            'count_likes': 1,
            'has_liked': True,
        })
        mock_notify.assert_called_once_with(
            user=self.author,
            url=self.post.get_absolute_url(),
            content="'Like Action' 글을 @action-reader님께서 추천하였습니다.",
        )

    @patch('board.views.post_actions.create_notify')
    def test_like_does_not_notify_when_notification_setting_is_disabled(self, mock_notify):
        self.author_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE, 'false')

        self.client.post('/like/like-action')

        mock_notify.assert_not_called()

    @patch('board.views.post_actions.create_notify')
    def test_unlike_does_not_send_a_second_notification(self, mock_notify):
        self.author_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE, 'true')

        self.client.post('/like/like-action')
        response = self.client.post('/like/like-action')

        self.assertEqual(json.loads(response.content), {
            'status': 'done',
            'count_likes': 0,
            'has_liked': False,
        })
        self.assertEqual(mock_notify.call_count, 1)

    @patch('board.views.post_actions.create_notify')
    def test_author_liking_own_post_does_not_notify(self, mock_notify):
        self.author_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE, 'true')
        self.client.force_login(self.author)

        self.client.post('/like/like-action')

        mock_notify.assert_not_called()
