import json
from datetime import timedelta
from urllib.parse import urlencode

from django.test import TestCase
from django.utils import timezone

from board.admin.utilities.image_cleaner import ImageCleanerService
from board.models import (
    Comment,
    Config,
    EditHistory,
    PinnedPost,
    Post,
    PostConfig,
    PostContent,
    PostLikes,
    Profile,
    Series,
    Tag,
    User,
)
from board.services.pinned_post_service import PinnedPostService
from board.services.post_image_service import PostImageService
from board.services.post_service import PostService
from board.services.post_status_service import PostStatusService
from board.services.post_trash_service import PostTrashService
from board.services.user_heatmap_service import UserHeatmapService
from board.services.user_service import UserService


class PostTrashAPITestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='trash-author',
            password='password',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.other_editor = User.objects.create_user(
            username='trash-other',
            password='password',
        )
        Profile.objects.create(user=cls.other_editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_editor)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
        self.series = Series.objects.create(
            owner=self.author,
            name='Trash Series',
            url='trash-series',
            text_md='',
            text_html='',
        )
        self.post = self.create_post(
            title='Recoverable post',
            url='recoverable-post',
            published_date=timezone.now() - timedelta(days=1),
        )

    def create_post(
        self,
        *,
        title: str,
        url: str,
        published_date,
        hide: bool = False,
    ) -> Post:
        post = Post.objects.create(
            author=self.author,
            series=self.series,
            title=title,
            subtitle=f'{title} subtitle',
            url=url,
            meta_description=f'{title} description',
            published_date=published_date,
        )
        PostContent.objects.create(
            post=post,
            content_html=f'<p>{title} body</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=hide,
            advertise=True,
            block_comment=True,
        )
        return post

    def restore_url(self, post: Post) -> str:
        return f'/v1/setting/trash-posts/{post.url}/restore'

    def purge_url(self, post: Post, deleted_date: str) -> str:
        return (
            f'/v1/setting/trash-posts/{post.url}?'
            + urlencode({'expectedDeletedDate': deleted_date})
        )

    def test_session_delete_moves_published_and_draft_posts_to_trash(self):
        tag = Tag.objects.create(value='trash-tag')
        self.post.tags.add(tag)
        comment = Comment.objects.create(
            author=self.author,
            post=self.post,
            text_md='Keep comment',
            text_html='<p>Keep comment</p>',
        )
        original_updated_date = self.post.updated_date
        self.client.force_login(self.author)

        response = self.client.delete(
            f'/v1/users/@{self.author.username}/posts/{self.post.url}'
        )

        self.assertEqual(response.json()['status'], 'DONE')
        self.assertTrue(response.json()['body']['trashed'])
        self.assertFalse(Post.objects.filter(pk=self.post.pk).exists())
        trashed = Post.all_objects.get(pk=self.post.pk)
        self.assertIsNotNone(trashed.deleted_date)
        self.assertEqual(trashed.updated_date, original_updated_date)
        self.assertEqual(trashed.content.content_html, '<p>Recoverable post body</p>')
        self.assertEqual(set(trashed.tagging()), {'trash-tag'})
        self.assertTrue(Comment.objects.filter(pk=comment.pk).exists())

        draft = self.create_post(
            title='Recoverable draft',
            url='recoverable-draft',
            published_date=None,
        )
        draft_response = self.client.delete(f'/v1/drafts/{draft.url}')
        self.assertEqual(draft_response.json()['status'], 'DONE')
        self.assertFalse(Post.objects.filter(pk=draft.pk).exists())
        self.assertTrue(
            Post.all_objects.filter(pk=draft.pk, deleted_date__isnull=False).exists()
        )

    def test_trash_list_classifies_states_and_is_scoped_to_current_owner(self):
        draft = self.create_post(
            title='Trashed draft',
            url='trashed-draft',
            published_date=None,
        )
        scheduled = self.create_post(
            title='Trashed schedule',
            url='trashed-schedule',
            published_date=timezone.now() + timedelta(days=1),
        )
        elapsed = self.create_post(
            title='Elapsed schedule',
            url='elapsed-schedule',
            published_date=timezone.now() - timedelta(minutes=1),
        )
        PostTrashService.trash_post(self.post)
        PostTrashService.trash_post(draft)
        PostTrashService.trash_post(scheduled)
        Post.all_objects.filter(pk=elapsed.pk).update(
            deleted_date=timezone.now() - timedelta(minutes=2),
        )
        self.client.force_login(self.author)

        response = self.client.get('/v1/setting/trash-posts')

        self.assertEqual(response.json()['status'], 'DONE')
        body = response.json()['body']
        self.assertEqual(body['pagination']['totalCount'], 4)
        self.assertEqual(body['retention'], {'mode': 'manual'})
        posts = {post['url']: post for post in body['posts']}
        self.assertEqual(posts[self.post.url]['sourceStatus'], 'published')
        self.assertEqual(posts[draft.url]['sourceStatus'], 'draft')
        self.assertEqual(posts[scheduled.url]['sourceStatus'], 'scheduled')
        self.assertFalse(posts[scheduled.url]['scheduleElapsed'])
        self.assertEqual(posts[elapsed.url]['sourceStatus'], 'scheduled')
        self.assertTrue(posts[elapsed.url]['scheduleElapsed'])

        self.client.force_login(self.other_editor)
        other_response = self.client.get('/v1/setting/trash-posts')
        self.assertEqual(other_response.json()['body']['posts'], [])
        self.assertEqual(
            self.client.post(
                self.restore_url(self.post),
                json.dumps({'expectedDeletedDate': posts[self.post.url]['deletedDate']}),
                content_type='application/json',
            ).status_code,
            404,
        )

        self.client.logout()
        self.assertEqual(
            self.client.get('/v1/setting/trash-posts').json()['errorCode'],
            'error:NL',
        )

    def test_restore_preserves_post_state_relations_and_pinned_visibility(self):
        tag = Tag.objects.create(value='restore-tag')
        self.post.tags.add(tag)
        comment = Comment.objects.create(
            author=self.author,
            post=self.post,
            text_md='Restore comment',
            text_html='<p>Restore comment</p>',
        )
        history = EditHistory.objects.create(
            post=self.post,
            actor=self.author,
            title='Before restore',
            content='<p>Old body</p>',
        )
        pin = PinnedPost.objects.create(user=self.author, post=self.post, order=0)
        original = {
            'url': self.post.url,
            'published_date': self.post.published_date,
            'updated_date': self.post.updated_date,
            'series_id': self.post.series_id,
            'hide': self.post.config.hide,
            'advertise': self.post.config.advertise,
            'block_comment': self.post.config.block_comment,
        }
        trashed = PostTrashService.trash_post(self.post)
        deleted_date = trashed.deleted_date.isoformat()
        self.assertEqual(PinnedPostService.get_user_pinned_posts(self.author), [])
        self.client.force_login(self.author)

        response = self.client.post(
            self.restore_url(trashed),
            json.dumps({'expectedDeletedDate': deleted_date}),
            content_type='application/json',
        )

        self.assertEqual(response.json()['status'], 'DONE')
        self.assertEqual(response.json()['body']['status'], 'published')
        restored = Post.objects.get(pk=self.post.pk)
        restored.config.refresh_from_db()
        self.assertIsNone(restored.deleted_date)
        self.assertEqual(restored.url, original['url'])
        self.assertEqual(restored.published_date, original['published_date'])
        self.assertEqual(restored.updated_date, original['updated_date'])
        self.assertEqual(restored.series_id, original['series_id'])
        self.assertEqual(restored.config.hide, original['hide'])
        self.assertEqual(restored.config.advertise, original['advertise'])
        self.assertEqual(restored.config.block_comment, original['block_comment'])
        self.assertEqual(set(restored.tagging()), {'restore-tag'})
        self.assertTrue(Comment.objects.filter(pk=comment.pk).exists())
        self.assertTrue(EditHistory.objects.filter(pk=history.pk).exists())
        self.assertTrue(PinnedPost.objects.filter(pk=pin.pk).exists())
        self.assertEqual(len(PinnedPostService.get_user_pinned_posts(self.author)), 1)

        retrash = PostTrashService.trash_post(restored)
        stale_response = self.client.post(
            self.restore_url(retrash),
            json.dumps({'expectedDeletedDate': deleted_date}),
            content_type='application/json',
        )
        self.assertEqual(stale_response.json()['status'], 'ERROR')
        self.assertFalse(Post.objects.filter(pk=restored.pk).exists())

    def test_permanent_delete_requires_current_trash_version_and_cascades(self):
        history = EditHistory.objects.create(
            post=self.post,
            actor=self.author,
            title='Purge history',
            content='<p>Purge body</p>',
        )
        pin = PinnedPost.objects.create(user=self.author, post=self.post, order=0)
        trashed = PostTrashService.trash_post(self.post)
        deleted_date = trashed.deleted_date.isoformat()
        self.client.force_login(self.author)

        stale_response = self.client.delete(
            self.purge_url(trashed, (trashed.deleted_date - timedelta(seconds=1)).isoformat())
        )
        self.assertEqual(stale_response.json()['status'], 'ERROR')
        self.assertTrue(Post.all_objects.filter(pk=self.post.pk).exists())

        response = self.client.delete(self.purge_url(trashed, deleted_date))

        self.assertEqual(response.json()['status'], 'DONE')
        self.assertTrue(response.json()['body']['deleted'])
        self.assertFalse(Post.all_objects.filter(pk=self.post.pk).exists())
        self.assertFalse(EditHistory.objects.filter(pk=history.pk).exists())
        self.assertFalse(PinnedPost.objects.filter(pk=pin.pk).exists())

    def test_trashed_url_and_images_remain_reserved_until_permanent_delete(self):
        Post.all_objects.filter(pk=self.post.pk).update(
            image='images/title/trash-shared.jpg',
            image_hash='trash-image-hash',
        )
        self.post.refresh_from_db()
        PostTrashService.trash_post(self.post)

        candidate = Post(author=self.author, title='URL candidate')
        candidate.create_unique_url(self.post.url)

        self.assertNotEqual(candidate.url, self.post.url)
        self.assertTrue(
            PostImageService.is_image_shared(
                'images/title/trash-shared.jpg',
                exclude_post_id=-1,
            )
        )
        self.assertIn(
            'trash-shared.jpg',
            ImageCleanerService().scan_title_images(),
        )

    def test_existing_hard_delete_service_remains_permanent(self):
        post_id = self.post.id

        PostService.delete_post(self.post)

        self.assertFalse(Post.all_objects.filter(pk=post_id).exists())

    def test_trashed_posts_are_not_draft_scheduled_or_published(self):
        trashed = PostTrashService.trash_post(self.post)

        self.assertFalse(PostStatusService.is_draft(trashed))
        self.assertFalse(PostStatusService.is_scheduled(trashed))
        self.assertFalse(PostStatusService.is_published(trashed))
        self.assertFalse(
            PostStatusService.filter_published(Post.all_objects).filter(pk=trashed.pk).exists()
        )

    def test_trashed_relations_do_not_leak_into_private_activity_surfaces(self):
        Comment.objects.create(
            author=self.author,
            post=self.post,
            text_md='Private activity comment',
            text_html='<p>Private activity comment</p>',
        )
        PostLikes.objects.create(user=self.author, post=self.post)
        post_url = self.post.get_absolute_url()
        PostTrashService.trash_post(self.post)
        self.client.force_login(self.author)

        comments_response = self.client.get('/v1/comments/user')

        self.assertEqual(comments_response.json()['body']['comments'], [])
        self.assertEqual(UserHeatmapService.build_settings_heatmap(self.author), {})
        activities = UserService.get_user_dashboard_activities(self.author)
        self.assertNotIn(post_url, {activity['url'] for activity in activities})

    def test_trashed_pinned_post_reserves_limit_and_restores_after_reorder(self):
        pinned_posts = [self.post]
        for index in range(1, PinnedPostService.MAX_PINNED_POSTS):
            pinned_posts.append(self.create_post(
                title=f'Pinned post {index}',
                url=f'pinned-post-{index}',
                published_date=timezone.now() - timedelta(days=1),
            ))
        candidate = self.create_post(
            title='Pinned candidate',
            url='pinned-candidate',
            published_date=timezone.now() - timedelta(days=1),
        )
        for order, post in enumerate(pinned_posts):
            PinnedPost.objects.create(user=self.author, post=post, order=order)

        trashed = PostTrashService.trash_post(self.post)
        deleted_date = trashed.deleted_date.isoformat()
        self.client.force_login(self.author)

        setting_response = self.client.get('/v1/setting/pinned-posts')
        add_response = self.client.post(
            '/v1/setting/pinned-posts',
            {'post_url': candidate.url},
        )

        self.assertEqual(setting_response.json()['body']['reservedCount'], 1)
        self.assertEqual(len(setting_response.json()['body']['pinnedPosts']), 5)
        self.assertEqual(add_response.json()['status'], 'ERROR')
        self.assertIn('최대 6개', add_response.json()['errorMessage'])

        visible_urls = [post.url for post in reversed(pinned_posts[1:])]
        PinnedPostService.reorder_pinned_posts(self.author, visible_urls)
        PostTrashService.restore_post(
            trashed,
            expected_deleted_date=deleted_date,
        )

        restored_pins = PinnedPost.objects.filter(
            user=self.author,
        ).order_by('order', 'id')
        self.assertEqual(
            list(restored_pins.values_list('order', flat=True)),
            list(range(PinnedPostService.MAX_PINNED_POSTS)),
        )
        self.assertEqual(
            len(PinnedPostService.get_user_pinned_posts(self.author)),
            PinnedPostService.MAX_PINNED_POSTS,
        )
