import json

from django.test import Client, TestCase
from django.utils import timezone

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
            published_date=timezone.now(),
        )

        PostContent.objects.create(
            post=Post.objects.get(url='test-post'),
            content_html='<h1>Post</h1>'
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
        """포스트 댓글 목록 조회 테스트"""
        response = self.client.get('/v1/posts/test-post/comments')
        self.assertEqual(response.status_code, 200)

    def test_post_comment_list_hides_comments_when_post_hidden(self):
        """숨김 글의 댓글은 공개 댓글 목록에 노출되지 않는다."""
        post = Post.objects.get(url='test-post')
        post.config.hide = True
        post.config.save()

        response = self.client.get('/v1/posts/test-post/comments')
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['comments'], [])

    def test_post_comment_list_hides_comments_when_post_is_draft(self):
        """임시저장 글의 댓글은 공개 댓글 목록에 노출되지 않는다."""
        post = Post.objects.get(url='test-post')
        post.published_date = None
        post.save(update_fields=['published_date'])

        response = self.client.get('/v1/posts/test-post/comments')
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['comments'], [])

    def test_post_comment_list_hides_comments_when_post_is_scheduled(self):
        """미래 발행 글의 댓글은 공개 댓글 목록에 노출되지 않는다."""
        post = Post.objects.get(url='test-post')
        post.published_date = timezone.now() + timezone.timedelta(days=1)
        post.save(update_fields=['published_date'])

        response = self.client.get('/v1/posts/test-post/comments')
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['body']['comments'], [])

    def test_create_comment(self):
        """댓글 생성 테스트"""
        self.client.login(username='viewer', password='test')
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Comment.objects.last().text_md, '# New Comment')

    def test_create_comment_requires_csrf_token_when_enforced(self):
        """세션 기반 댓글 생성 API는 CSRF 토큰을 요구한다."""
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.login(username='viewer', password='test')
        initial_count = Comment.objects.count()

        response = csrf_client.post('/v1/comments?url=test-post', {
            'comment_md': '# Missing CSRF',
        })

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_comment_on_hidden_post_returns_404(self):
        """숨김 글에는 공개 댓글 API로 댓글을 생성할 수 없다."""
        post = Post.objects.get(url='test-post')
        post.config.hide = True
        post.config.save()
        initial_count = Comment.objects.count()
        self.client.login(username='viewer', password='test')

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# Hidden Post Comment',
        })

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_comment_on_draft_post_returns_404(self):
        """임시저장 글에는 공개 댓글 API로 댓글을 생성할 수 없다."""
        post = Post.objects.get(url='test-post')
        post.published_date = None
        post.save(update_fields=['published_date'])
        initial_count = Comment.objects.count()
        self.client.login(username='viewer', password='test')

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# Draft Post Comment',
        })

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_comment_on_scheduled_post_returns_404(self):
        """미래 발행 글에는 공개 댓글 API로 댓글을 생성할 수 없다."""
        post = Post.objects.get(url='test-post')
        post.published_date = timezone.now() + timezone.timedelta(days=1)
        post.save(update_fields=['published_date'])
        initial_count = Comment.objects.count()
        self.client.login(username='viewer', password='test')

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# Scheduled Post Comment',
        })

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_comment_on_blocked_post_returns_error(self):
        """댓글 차단 글에는 댓글을 생성할 수 없다."""
        post = Post.objects.get(url='test-post')
        post.config.block_comment = True
        post.config.save()
        initial_count = Comment.objects.count()
        self.client.login(username='viewer', password='test')

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': '# Blocked Comment',
        })

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('댓글이 차단된 글입니다', content['errorMessage'])
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_reply_rejects_parent_from_other_post(self):
        """대댓글 parent는 같은 글의 댓글이어야 한다."""
        author = User.objects.get(username='author')
        other_post = Post.objects.create(
            url='other-post',
            title='Other Post',
            author=author,
            published_date=timezone.now(),
        )
        PostContent.objects.create(
            post=other_post,
            content_html='<h1>Other Post</h1>',
        )
        PostConfig.objects.create(
            post=other_post,
            hide=False,
            advertise=False,
        )
        other_parent = Comment.objects.create(
            post=other_post,
            author=User.objects.get(username='viewer'),
            text_md='Other post comment',
            text_html='<p>Other post comment</p>',
        )
        initial_count = Comment.objects.count()
        self.client.login(username='author', password='test')

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': 'Cross-post reply',
            'parent_id': other_parent.id,
        })

        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('부모 댓글이 대상 글에 속하지 않습니다', content['errorMessage'])
        self.assertEqual(Comment.objects.count(), initial_count)

    def test_create_nested_comment(self):
        """대댓글 생성 테스트"""
        parent_comment = Comment.objects.last()

        self.client.login(username='author', password='test')
        data = {
            'comment_md': 'Reply to comment',
            'parent_id': parent_comment.id,
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        self.assertEqual(response.status_code, 200)

        reply = Comment.objects.last()
        self.assertEqual(reply.parent_id, parent_comment.id)
        self.assertEqual(reply.text_md, 'Reply to comment')

    def test_prevent_deeply_nested_comments(self):
        """대댓글의 대댓글 방지 테스트"""
        parent_comment = Comment.objects.last()

        self.client.login(username='author', password='test')
        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': 'First reply',
            'parent_id': parent_comment.id,
        })
        self.assertEqual(response.status_code, 200)

        first_reply = Comment.objects.last()

        response = self.client.post('/v1/comments?url=test-post', {
            'comment_md': 'Second reply (should fail)',
            'parent_id': first_reply.id,
        })
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertIn('대댓글에는 답글을 달 수 없습니다', content['errorMessage'])

    def test_notify_parent_comment_author_on_reply(self):
        """대댓글 작성 시 부모 댓글 작성자에게 알림 발송 테스트"""
        viewer = User.objects.get(username='viewer')
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT, 'true')

        parent_comment = Comment.objects.last()

        self.client.login(username='author', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': 'Reply to your comment',
            'parent_id': parent_comment.id,
        })

        last_notify = Notify.objects.filter(user=viewer).last()
        self.assertIsNotNone(last_notify)
        self.assertIn('@author', last_notify.content)
        self.assertIn('답글', last_notify.content)

    def test_notify_mentioned_user_in_reply(self):
        """대댓글에서 멘션된 사용자에게 알림 발송 테스트"""
        viewer = User.objects.get(username='viewer')
        viewer.config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')

        parent_comment = Comment.objects.last()

        self.client.login(username='author', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': '`@viewer` mentioned in reply',
            'parent_id': parent_comment.id,
        })

        mention_notify = Notify.objects.filter(
            user=viewer,
            content__contains='태그'
        ).last()
        self.assertIsNotNone(mention_notify)
        self.assertIn('@author', mention_notify.content)

    def test_notify_on_create_comment(self):
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

    def test_not_notify_on_create_comment_when_user_disagree_notify(self):
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

    def test_create_comment_not_logged_in(self):
        """비로그인 상태에서 댓글 생성 실패 테스트"""
        data = {
            'comment_md': '# New Comment',
        }
        response = self.client.post('/v1/comments?url=test-post', data)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_comment_raw_markdown_only_visible_to_comment_author(self):
        """댓글 원문은 댓글 작성자에게만 노출된다."""
        comment = Comment.objects.get(text_md='Comment')
        self.client.login(username='author', password='test')

        response = self.client.get(f'/v1/comments/{comment.id}')
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['status'], 'ERROR')
        self.assertNotIn('textMd', content.get('body', {}))

    def test_comment_raw_markdown_visible_to_comment_author(self):
        """댓글 작성자는 수정용 원문을 조회할 수 있다."""
        comment = Comment.objects.get(text_md='Comment')
        self.client.login(username='viewer', password='test')

        response = self.client.get(f'/v1/comments/{comment.id}')
        content = json.loads(response.content)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['textMd'], 'Comment')

    def test_comment_raw_markdown_hidden_when_parent_post_is_not_public(self):
        """비공개 글의 댓글 원문은 댓글 작성자에게도 공개 API에서 노출하지 않는다."""
        post = Post.objects.get(url='test-post')
        post.config.hide = True
        post.config.save()
        comment = Comment.objects.get(text_md='Comment')
        self.client.login(username='viewer', password='test')

        response = self.client.get(f'/v1/comments/{comment.id}')

        self.assertEqual(response.status_code, 404)

    def test_notify_user_tag_on_comment_when_user_agree_notify(self):
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

    def test_comment_markdown_renders_mentions_as_links(self):
        """댓글 마크다운에서는 멘션이 링크로 변환되어야 함"""
        self.client.login(username='author', password='test')
        self.client.post('/v1/comments?url=test-post', {
            'comment_md': '`@viewer` mention',
        })

        comment = Comment.objects.last()
        self.assertIn('class="mention"', comment.text_html)
        self.assertIn('href="/@viewer"', comment.text_html)

    def test_not_notify_user_tag_on_comment_when_user_disagree_notify(self):
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

    # Comment Edit Tests
    def test_edit_comment(self):
        """댓글 수정 테스트"""
        comment = Comment.objects.last()
        self.client.login(username='viewer', password='test')

        response = self.client.put(
            f'/v1/comments/{comment.id}',
            'comment=comment&comment_md=Edited comment'
        )
        self.assertEqual(response.status_code, 200)

        comment.refresh_from_db()
        self.assertEqual(comment.text_md, 'Edited comment')
        self.assertTrue(comment.edited)

    def test_edit_comment_not_author(self):
        """본인이 아닌 댓글 수정 시도 시 실패"""
        comment = Comment.objects.last()
        self.client.login(username='author', password='test')

        response = self.client.put(
            f'/v1/comments/{comment.id}',
            'comment=comment&comment_md=Hacked'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        comment.refresh_from_db()
        self.assertNotEqual(comment.text_md, 'Hacked')

    def test_edit_comment_not_logged_in(self):
        """비로그인 상태에서 댓글 수정 시도 시 실패"""
        comment = Comment.objects.last()

        response = self.client.put(
            f'/v1/comments/{comment.id}',
            'comment=comment&comment_md=Hacked'
        )
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    # Comment Delete Tests
    def test_delete_comment(self):
        """댓글 삭제 테스트 (소프트 삭제)"""
        comment = Comment.objects.last()
        comment_id = comment.id
        self.client.login(username='viewer', password='test')

        response = self.client.delete(f'/v1/comments/{comment_id}')
        self.assertEqual(response.status_code, 200)

        comment.refresh_from_db()
        self.assertIsNone(comment.author)  # Soft delete removes author

    def test_delete_comment_not_author(self):
        """본인이 아닌 댓글 삭제 시도 시 실패"""
        comment = Comment.objects.last()
        self.client.login(username='author', password='test')

        response = self.client.delete(f'/v1/comments/{comment.id}')
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

        comment.refresh_from_db()
        self.assertIsNotNone(comment.author)

    def test_delete_comment_not_logged_in(self):
        """비로그인 상태에서 댓글 삭제 시도 시 실패"""
        comment = Comment.objects.last()

        response = self.client.delete(f'/v1/comments/{comment.id}')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')

    def test_like_deleted_comment(self):
        """삭제된 댓글에 좋아요 시도 시 실패"""
        comment = Comment.objects.last()
        comment.author = None  # Simulate soft delete
        comment.save()

        self.client.login(username='author', password='test')
        response = self.client.put(
            f'/v1/comments/{comment.id}', "like=like")
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
