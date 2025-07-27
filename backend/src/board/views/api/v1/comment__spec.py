import json

from unittest.mock import patch

from django.test import TestCase

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, Config, Post, PostContent, PostConfig,
    Profile, Comment, Notify)


class CommentTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        User.objects.create_user(
            username='author',
            password='test',
        )

        Config.objects.create(
            user=User.objects.get(username='author'),
        )

        Profile.objects.create(
            user=User.objects.get(username='author'),
        )

        User.objects.create_user(
            username='viewer',
            password='test',
        )

        Config.objects.create(
            user=User.objects.get(username='viewer'),
        )

        Profile.objects.create(
            user=User.objects.get(username='viewer'),
        )

        Post.objects.create(
            url='test-post',
            title='Post',
            author=User.objects.get(username='author'),
        )

        PostContent.objects.create(
            post=Post.objects.get(url='test-post'),
            text_md='# Post',
            text_html='<h1>Post</h1>'
        )

        PostConfig.objects.create(
            post=Post.objects.get(url='test-post'),
            hide=False,
            advertise=False,
        )

        Comment.objects.create(
            post=Post.objects.get(url='test-post'),
            author=User.objects.get(username='viewer'),
            text_md='Comment',
            text_html='<p>Comment</p>',
        )

    def test_get_post_comment_list(self):
        response = self.client.get('/v1/posts/test-post/comments')
        self.assertEqual(response.status_code, 200)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_comment(self, mock_service):
        self.client.login(username='viewer', password='test')
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().text_md, '# New Comment')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_notify_on_create_comment(self, mock_service):
        author = User.objects.get(username='author')
        author.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT, 'true')

        self.client.login(username='viewer', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# New Comment',
        })

        last_notify = Notify.objects.filter(user=author).last()
        self.assertTrue(
            '@viewer' in last_notify.content and
            'Post' in last_notify.content
        )

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_not_notify_on_create_comment_when_user_disagree_notify(self, mock_service):
        author = User.objects.get(username='author')
        Notify.objects.create(
            user=author,
            url='/mock',
            content='mock last notify',
        )
        author.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT, 'false')

        self.client.login(username='viewer', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# New Comment',
        })

        last_notify = Notify.objects.filter(user=author).last()
        self.assertTrue('mock last notify' in last_notify.content)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_comment_not_logged_in(self, mock_service):
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_notify_user_tag_on_comment_when_user_agree_notify(self, mock_service):
        viewer = User.objects.get(username='viewer')
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')

        self.client.login(username='author', password='test')
        data = {
            'comment_md': '`@viewer` reply comment',
        }
        self.client.post('/v1/comments?url=test-post', data)

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertTrue('@author' in last_notify.content)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_not_notify_user_tag_on_comment_when_user_disagree_notify(self, mock_service):
        viewer = User.objects.get(username='viewer')
        Notify.objects.create(
            user=viewer,
            url='/mock',
            content='mock last notify',
        )
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'false')

        self.client.login(username='author', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': '`@viewer` reply comment',
        })

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertTrue('mock last notify' in last_notify.content)

    def test_user_comment_like(self):
        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().likes.count(), 1)

    def test_notify_user_comment_like_when_user_agree_notify(self):
        viewer = User.objects.get(username='viewer')
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')

        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertTrue('@author' in last_notify.content)

    def test_not_notify_user_comment_like_when_user_disagree_notify(self):
        viewer = User.objects.get(username='viewer')
        Notify.objects.create(
            user=viewer,
            url='/mock',
            content='mock last notify',
        )
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'false')

        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertTrue('mock last notify' in last_notify.content)

    def test_user_comment_unlike(self):
        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().likes.count(), 1)

        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().likes.count(), 0)

    def test_user_comment_self_like(self):
        last_comment = Comment.objects.last()
        self.client.login(username='viewer', password='test')
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(Comment.objects.last().likes.count(), 0)

    def test_user_comment_like_not_logged_in(self):
        last_comment = Comment.objects.last()
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(Comment.objects.last().likes.count(), 0)
