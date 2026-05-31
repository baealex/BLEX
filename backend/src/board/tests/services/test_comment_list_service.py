from django.test import TestCase
from django.utils import timezone

from board.models import Comment, Config, Post, PostConfig, PostContent, Profile, User
from board.services.comment_list_service import CommentListService


class CommentListServiceTestCase(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username='comment-author', password='test')
        self.viewer = User.objects.create_user(username='comment-viewer', password='test')
        for user in (self.author, self.viewer):
            Config.objects.create(user=user)
            Profile.objects.create(user=user)
        self.post = Post.objects.create(
            url='comment-list-post',
            title='Post',
            author=self.author,
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=self.post, content_html='<p>Post</p>')
        PostConfig.objects.create(post=self.post, hide=False)
        self.parent = Comment.objects.create(
            post=self.post,
            author=self.viewer,
            text_md='Parent',
            text_html='<p>Parent</p>',
        )
        self.reply = Comment.objects.create(
            post=self.post,
            author=self.author,
            parent=self.parent,
            text_md='Reply',
            text_html='<p>Reply</p>',
        )

    def test_serialize_post_comments_preserves_parent_and_reply_shape(self):
        payload = CommentListService.serialize_post_comments(
            self.post.url,
            self.viewer,
        )

        self.assertEqual(len(payload['comments']), 1)
        comment = payload['comments'][0]
        self.assertEqual(comment['id'], self.parent.id)
        self.assertEqual(comment['author'], 'comment-viewer')
        self.assertTrue(comment['is_mine'])
        self.assertEqual(comment['count_likes'], 0)
        self.assertFalse(comment['is_liked'])
        self.assertFalse(comment['is_deleted'])
        self.assertEqual(comment['permissions'], {
            'can_edit': True,
            'can_delete': True,
            'can_like': False,
            'can_reply': True,
        })
        self.assertEqual(len(comment['replies']), 1)
        self.assertEqual(comment['replies'][0]['parent_id'], self.parent.id)
        self.assertFalse(comment['replies'][0]['is_mine'])
        self.assertEqual(comment['replies'][0]['permissions'], {
            'can_edit': False,
            'can_delete': False,
            'can_like': True,
            'can_reply': True,
        })

    def test_serialize_deleted_comment_marks_deleted_permissions(self):
        self.parent.author = None
        self.parent.save(update_fields=['author'])

        payload = CommentListService.serialize_post_comments(
            self.post.url,
            self.viewer,
        )

        comment = payload['comments'][0]
        self.assertEqual(comment['author'], 'Ghost')
        self.assertTrue(comment['is_deleted'])
        self.assertEqual(comment['rendered_content'], '<p>삭제된 댓글입니다.</p>')
        self.assertEqual(comment['permissions'], {
            'can_edit': False,
            'can_delete': False,
            'can_like': False,
            'can_reply': False,
        })
