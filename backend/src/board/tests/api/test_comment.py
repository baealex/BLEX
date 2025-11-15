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
            role=Profile.Role.EDITOR
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
            role=Profile.Role.READER
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
        """게시글 댓글 목록 조회 테스트"""
        response = self.client.get('/v1/posts/test-post/comments')
        self.assertEqual(response.status_code, 200)

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_create_comment(self, mock_service):
        """댓글 생성 테스트"""
        self.client.login(username='viewer', password='test')
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().text_md, '# New Comment')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_notify_on_create_comment(self, mock_service):
        """댓글 생성 시 작성자에게 알림 발송 테스트"""
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
        """사용자가 알림 거부 시 댓글 생성 알림 미발송 테스트"""
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
        """비로그인 상태에서 댓글 생성 실패 테스트"""
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    @patch('modules.markdown.parse_to_html', return_value='<h1>Mocked Text</h1>')
    def test_notify_user_tag_on_comment_when_user_agree_notify(self, mock_service):
        """댓글에서 사용자 태그 시 알림 발송 테스트"""
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
        """사용자가 멘션 알림 거부 시 태그 알림 미발송 테스트"""
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
        """댓글 좋아요 테스트"""
        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().likes.count(), 1)

    def test_notify_user_comment_like_when_user_agree_notify(self):
        """댓글 좋아요 시 알림 발송 테스트"""
        viewer = User.objects.get(username='viewer')
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')

        last_comment = Comment.objects.last()
        self.client.login(username='author', password='test')
        self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertTrue('@author' in last_notify.content)

    def test_not_notify_user_comment_like_when_user_disagree_notify(self):
        """사용자가 좋아요 알림 거부 시 알림 미발송 테스트"""
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
        """댓글 좋아요 취소 테스트"""
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
        """자신의 댓글에 좋아요 시도 시 실패 테스트"""
        last_comment = Comment.objects.last()
        self.client.login(username='viewer', password='test')
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(Comment.objects.last().likes.count(), 0)

    def test_user_comment_like_not_logged_in(self):
        """비로그인 상태에서 댓글 좋아요 시도 시 실패 테스트"""
        last_comment = Comment.objects.last()
        response = self.client.put(
            f'/v1/comments/{last_comment.id}', "like=like")
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(Comment.objects.last().likes.count(), 0)
