import json
from datetime import datetime, timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from board.models import (
    Config,
    EditHistory,
    Post,
    PostConfig,
    PostContent,
    Profile,
    User,
)
from board.services.post_revision_service import (
    PostRevisionService,
    PostRevisionSnapshot,
)
from board.services.post_service import PostService
from board.services.post_timelapse_service import PostTimelapseService


class PostTimelapseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='timelapse-author',
            password='password',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.other_editor = User.objects.create_user(
            username='timelapse-other',
            password='password',
        )
        Profile.objects.create(user=cls.other_editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_editor)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def create_post(
        self,
        *,
        url: str = 'timelapse-post',
        published: bool = True,
        title: str = 'Current title',
        body: str = '<p>Current body</p>',
    ) -> Post:
        post = Post.objects.create(
            author=self.author,
            title=title,
            url=url,
            published_date=(
                timezone.now() - timedelta(days=1) if published else None
            ),
        )
        PostContent.objects.create(post=post, content_html=body)
        PostConfig.objects.create(post=post)
        return post

    def add_snapshot(
        self,
        post: Post,
        *,
        title: str,
        body: str,
        change_type: str = EditHistory.ChangeType.EDIT,
        saved_at: datetime | None = None,
    ) -> EditHistory:
        return PostRevisionService.create_revision(
            post,
            PostRevisionSnapshot(
                title=title,
                subtitle='',
                content_html=body,
                description='',
                tags=(),
            ),
            change_type=change_type,
            source_updated_date=saved_at,
            actor=self.author,
        )

    def timelapse_url(self, post: Post) -> str:
        return f'/v1/users/@{self.author.username}/posts/{post.url}/timelapse'

    def put_draft(self, url: str, content: str) -> None:
        response = self.client.put(
            f'/v1/drafts/{url}',
            json.dumps({'title': 'Draft title', 'content': content}),
            content_type='application/json',
        )
        self.assertEqual(response.json()['status'], 'DONE')

    def test_draft_autosave_keeps_one_snapshot_per_interval(self):
        """초안 자동 저장은 간격마다 직전 상태를 한 번만 남긴다"""
        self.client.force_login(self.author)
        response = self.client.post(
            '/v1/drafts',
            json.dumps({'title': 'Draft title', 'content': '<p>One</p>'}),
            content_type='application/json',
        )
        url = response.json()['body']['url']
        draft = Post.objects.get(url=url)
        first_state = draft.content.content_html

        self.put_draft(url, '<p>One two</p>')
        self.put_draft(url, '<p>One two three</p>')
        draft.content.refresh_from_db()
        state_before_next_interval = draft.content.content_html

        snapshot = EditHistory.objects.get(post=draft)
        self.assertEqual(snapshot.change_type, EditHistory.ChangeType.DRAFT)
        self.assertEqual(snapshot.content, first_state)

        EditHistory.objects.filter(pk=snapshot.pk).update(
            created_date=timezone.now() - PostRevisionService.DRAFT_SNAPSHOT_INTERVAL,
        )
        self.put_draft(url, '<p>One two three four</p>')

        self.assertEqual(
            list(
                EditHistory.objects.filter(post=draft)
                .order_by('created_date', 'id')
                .values_list('content', flat=True)
            ),
            [first_state, state_before_next_interval],
        )

    def test_unchanged_draft_save_records_nothing(self):
        """내용이 그대로인 초안 저장은 기록하지 않는다"""
        draft = self.create_post(url='timelapse-draft', published=False)

        PostService.update_draft(draft, is_hide=True)

        self.assertFalse(EditHistory.objects.filter(post=draft).exists())

    def test_publishing_draft_records_last_draft_state(self):
        """발행할 때 바뀌는 내용이 있으면 발행 직전 초안을 남긴다"""
        draft = self.create_post(
            url='timelapse-publish',
            published=False,
            title='Draft title',
            body='<p>Draft body</p>',
        )

        PostService.publish_draft(
            draft,
            title='Published title',
            text_html='<p>Published body</p>',
            content_type='html',
        )

        snapshot = EditHistory.objects.get(post=draft)
        self.assertEqual(snapshot.change_type, EditHistory.ChangeType.DRAFT)
        self.assertEqual(snapshot.title, 'Draft title')
        self.assertEqual(snapshot.content, '<p>Draft body</p>')

    def test_editor_revision_history_hides_draft_saves(self):
        """편집기 수정 이력에는 초안 저장이 보이지 않는다"""
        post = self.create_post()
        draft_save = self.add_snapshot(
            post,
            title='Draft',
            body='<p>Draft</p>',
            change_type=EditHistory.ChangeType.DRAFT,
        )
        edit = self.add_snapshot(post, title='Edit', body='<p>Edit</p>')
        revisions_url = f'/v1/users/@{self.author.username}/posts/{post.url}/revisions'
        self.client.force_login(self.author)

        listing = self.client.get(revisions_url).json()['body']
        self.assertEqual([item['id'] for item in listing['revisions']], [edit.id])
        self.assertEqual(listing['pagination']['totalCount'], 1)
        self.assertEqual(
            self.client.get(f'{revisions_url}/{draft_save.id}').status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(f'{revisions_url}/{draft_save.id}').status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                f'{revisions_url}/{draft_save.id}/restore',
                json.dumps({'expectedUpdatedDate': post.updated_date.isoformat()}),
                content_type='application/json',
            ).status_code,
            404,
        )
        self.assertTrue(EditHistory.objects.filter(pk=draft_save.pk).exists())

    def test_author_replays_saves_oldest_first_ending_with_current_post(self):
        """작가는 저장본을 오래된 순서로 받고, 마지막은 지금 글이다"""
        post = self.create_post()
        first_saved_at = timezone.now() - timedelta(days=5)
        self.add_snapshot(
            post,
            title='Draft title',
            body='<p>Draft</p>',
            change_type=EditHistory.ChangeType.DRAFT,
            saved_at=first_saved_at,
        )
        self.add_snapshot(
            post,
            title='Draft title',
            body='<p>Draft</p>',
            saved_at=first_saved_at + timedelta(days=1),
        )
        self.add_snapshot(
            post,
            title='Current title',
            body='<p>Edited</p>',
            saved_at=first_saved_at + timedelta(days=2),
        )
        self.client.force_login(self.author)

        body = self.client.get(self.timelapse_url(post)).json()['body']

        self.assertEqual(
            [
                (frame['title'], frame['contentHtml'], frame['stage'])
                for frame in body['frames']
            ],
            [
                ('Draft title', '<p>Draft</p>', 'draft'),
                ('Current title', '<p>Edited</p>', 'published'),
                ('Current title', '<p>Current body</p>', 'published'),
            ],
        )
        self.assertEqual(body['frames'][0]['savedAt'], first_saved_at.isoformat())
        self.assertEqual(body['totalCount'], 3)
        self.assertEqual(body['publishedAt'], post.published_date.isoformat())

    def test_legacy_markers_inherit_later_state_and_old_html_is_sanitized(self):
        """레거시 '변경 없음' 표시는 다음 상태로 채우고, 옛 HTML은 지금 기준으로 정리한다"""
        post = self.create_post()
        EditHistory.objects.create(
            post=post,
            title='Old title',
            content='<p>Old</p><script>alert(1)</script><img src="/a.png" onerror="alert(1)">',
            change_type=EditHistory.ChangeType.LEGACY,
        )
        EditHistory.objects.create(
            post=post,
            title=PostTimelapseService.LEGACY_UNCHANGED_VALUE,
            content='<p>Middle</p>',
            change_type=EditHistory.ChangeType.LEGACY,
        )
        self.client.force_login(self.author)

        frames = self.client.get(self.timelapse_url(post)).json()['body']['frames']

        self.assertEqual(
            [frame['title'] for frame in frames],
            ['Old title', 'Current title', 'Current title'],
        )
        self.assertIn('<p>Old</p>', frames[0]['contentHtml'])
        self.assertNotIn('<script', frames[0]['contentHtml'])
        self.assertNotIn('onerror', frames[0]['contentHtml'])

    def test_timelapse_is_limited_to_author_editor_and_published_posts(self):
        """타임랩스는 작가 본인의 발행된 글에서만 열린다"""
        post = self.create_post()
        draft = self.create_post(url='timelapse-unpublished', published=False)
        self.add_snapshot(post, title='Old', body='<p>Old</p>')

        anonymous = self.client.get(self.timelapse_url(post))
        self.assertEqual(anonymous.json()['errorCode'], 'error:NL')

        self.client.force_login(self.other_editor)
        self.assertEqual(self.client.get(self.timelapse_url(post)).status_code, 404)

        self.client.force_login(self.author)
        self.assertEqual(self.client.get(self.timelapse_url(draft)).status_code, 404)
        self.assertEqual(self.client.post(self.timelapse_url(post)).status_code, 404)

    def test_long_history_is_sampled_keeping_first_and_current_frames(self):
        """저장본이 많으면 처음과 지금 글을 남기고 고르게 솎는다"""
        post = self.create_post()
        saved_count = PostTimelapseService.MAX_FRAMES + 20
        for index in range(saved_count):
            self.add_snapshot(post, title=f'Title {index}', body=f'<p>Body {index}</p>')
        self.client.force_login(self.author)

        with CaptureQueriesContext(connection) as queries:
            body = self.client.get(self.timelapse_url(post)).json()['body']

        self.assertEqual(len(body['frames']), PostTimelapseService.MAX_FRAMES)
        self.assertEqual(body['frames'][0]['title'], 'Title 0')
        self.assertEqual(body['frames'][-1]['contentHtml'], '<p>Current body</p>')
        self.assertEqual(body['totalCount'], saved_count + 1)
        self.assertLess(len(queries), 10)

    def test_post_page_offers_timelapse_only_to_author_with_history(self):
        """글 화면의 쓰인 과정 버튼은 이력이 있는 글의 작가에게만 보인다"""
        post = self.create_post()
        post_url = f'/@{self.author.username}/{post.url}'
        island_marker = 'PostTimelapse'

        self.client.force_login(self.author)
        self.assertNotContains(self.client.get(post_url), island_marker)

        self.add_snapshot(post, title='Old', body='<p>Old</p>')
        self.assertContains(self.client.get(post_url), island_marker)

        self.client.force_login(self.other_editor)
        self.assertNotContains(self.client.get(post_url), island_marker)

        self.client.logout()
        self.assertNotContains(self.client.get(post_url), island_marker)
