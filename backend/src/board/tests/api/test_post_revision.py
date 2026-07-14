import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from board.models import (
    Config,
    EditHistory,
    Post,
    PostConfig,
    PostContent,
    Profile,
    Series,
    Tag,
    User,
)
from board.services.post_revision_service import (
    PostRevisionService,
    PostRevisionSnapshot,
)
from board.services.post_service import PostService


class PostRevisionTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='revision-author',
            password='password',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.other_editor = User.objects.create_user(
            username='revision-other',
            password='password',
        )
        Profile.objects.create(user=cls.other_editor, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.other_editor)

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
        self.series = Series.objects.create(
            owner=self.author,
            name='Revision Series',
            url='revision-series',
            text_md='',
            text_html='',
        )
        self.post = Post.objects.create(
            author=self.author,
            series=self.series,
            title='Current title',
            subtitle='Current subtitle',
            url='revision-post',
            meta_description='Current description',
            published_date=timezone.now() - timedelta(days=1),
        )
        PostContent.objects.create(
            post=self.post,
            content_html='<p>Current body</p>',
        )
        PostConfig.objects.create(
            post=self.post,
            hide=True,
            advertise=True,
            block_comment=True,
            cover_layout=PostConfig.CoverLayout.NONE,
        )
        self.current_tag = Tag.objects.create(value='currenttag')
        self.post.tags.add(self.current_tag)

    def revision_url(self, suffix: str = '') -> str:
        return f'/v1/users/@{self.author.username}/posts/{self.post.url}/revisions{suffix}'

    def create_revision(
        self,
        *,
        title: str = 'Previous title',
        change_type: str = EditHistory.ChangeType.EDIT,
    ) -> EditHistory:
        return PostRevisionService.create_revision(
            self.post,
            PostRevisionSnapshot(
                title=title,
                subtitle='Previous subtitle',
                content_html='<p>Previous body</p>',
                description='Previous description',
                tags=('old-a', 'old-b'),
            ),
            change_type=change_type,
            source_updated_date=self.post.updated_date - timedelta(minutes=5),
            actor=self.author,
        )

    def test_editorial_update_records_complete_pre_edit_snapshot(self):
        previous_updated_date = self.post.updated_date

        PostService.update_post(
            self.post,
            title='Updated title',
            subtitle='Updated subtitle',
            text_html='<p>Updated body</p>',
            description='Updated description',
            tag='updated-b,updated-a',
            content_type='html',
        )

        revision = EditHistory.objects.get(post=self.post)
        self.assertEqual(revision.change_type, EditHistory.ChangeType.EDIT)
        self.assertEqual(revision.actor, self.author)
        self.assertEqual(revision.source_updated_date, previous_updated_date)
        self.assertEqual(revision.title, 'Current title')
        self.assertEqual(revision.subtitle, 'Current subtitle')
        self.assertEqual(revision.content, '<p>Current body</p>')
        self.assertEqual(revision.description, 'Current description')
        self.assertEqual(revision.tags, ['currenttag'])

    def test_noop_settings_only_and_draft_updates_do_not_create_revisions(self):
        PostService.update_post(
            self.post,
            title=self.post.title,
            subtitle=self.post.subtitle,
            text_html=self.post.content.content_html,
            description=self.post.meta_description,
            tag='currenttag',
            content_type='html',
        )
        PostService.update_post(
            self.post,
            is_hide=False,
            is_advertise=False,
            block_comment=False,
            cover_layout=PostConfig.CoverLayout.DEFAULT,
        )

        draft = Post.objects.create(
            author=self.author,
            title='Draft title',
            url='revision-draft',
        )
        PostContent.objects.create(post=draft, content_html='<p>Draft body</p>')
        PostConfig.objects.create(post=draft)
        PostService.update_post(
            draft,
            title='Changed draft title',
            text_html='<p>Changed draft body</p>',
            content_type='html',
        )

        self.assertFalse(EditHistory.objects.exists())

    def test_scheduled_editorial_update_records_revision(self):
        self.post.published_date = timezone.now() + timedelta(days=1)
        self.post.save(update_fields=['published_date'])

        PostService.update_post(self.post, title='Scheduled title changed')

        self.assertEqual(
            EditHistory.objects.get(post=self.post).title,
            'Current title',
        )

    def test_owner_can_page_list_and_open_revision_details(self):
        first = self.create_revision(title='First revision')
        second = self.create_revision(title='Second revision')
        third = self.create_revision(title='Third revision')
        self.client.force_login(self.author)

        response = self.client.get(self.revision_url(), {'page': 1, 'limit': 2})

        self.assertEqual(response.status_code, 200)
        body = response.json()['body']
        self.assertEqual(
            [revision['id'] for revision in body['revisions']],
            [third.id, second.id],
        )
        self.assertEqual(body['pagination'], {
            'page': 1,
            'limit': 2,
            'totalCount': 3,
            'lastPage': 2,
        })
        self.assertEqual(body['retention'], {'mode': 'unlimited'})
        self.assertEqual(body['currentUpdatedDate'], self.post.updated_date.isoformat())
        self.assertNotIn('contentHtml', body['revisions'][0])

        detail_response = self.client.get(self.revision_url(f'/{first.id}'))
        detail = detail_response.json()['body']['revision']
        self.assertEqual(detail['title'], 'First revision')
        self.assertEqual(detail['contentHtml'], '<p>Previous body</p>')
        self.assertEqual(detail['contentText'], 'Previous body')
        self.assertEqual(detail['tags'], ['old-a', 'old-b'])

    def test_revision_access_is_limited_to_current_owner_editor(self):
        revision = self.create_revision()

        anonymous = self.client.get(self.revision_url())
        self.assertEqual(anonymous.json()['errorCode'], 'error:NL')

        self.client.force_login(self.other_editor)
        self.assertEqual(self.client.get(self.revision_url()).status_code, 404)
        self.assertEqual(
            self.client.get(self.revision_url(f'/{revision.id}')).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                self.revision_url(f'/{revision.id}/restore'),
                json.dumps({'expectedUpdatedDate': self.post.updated_date.isoformat()}),
                content_type='application/json',
            ).status_code,
            404,
        )

    def test_restore_changes_only_editorial_fields_and_keeps_undo_revision(self):
        target = self.create_revision()
        original_url = self.post.url
        original_published_date = self.post.published_date
        original_series_id = self.post.series_id
        original_config = (
            self.post.config.hide,
            self.post.config.advertise,
            self.post.config.block_comment,
            self.post.config.cover_layout,
        )
        self.client.force_login(self.author)

        response = self.client.post(
            self.revision_url(f'/{target.id}/restore'),
            json.dumps({'expectedUpdatedDate': self.post.updated_date.isoformat()}),
            content_type='application/json',
        )

        self.assertEqual(response.json()['status'], 'DONE')
        self.assertTrue(response.json()['body']['restored'])
        self.post.refresh_from_db()
        self.post.content.refresh_from_db()
        self.post.config.refresh_from_db()
        self.assertEqual(self.post.title, 'Previous title')
        self.assertEqual(self.post.subtitle, 'Previous subtitle')
        self.assertEqual(self.post.content.content_html, '<p>Previous body</p>')
        self.assertEqual(self.post.meta_description, 'Previous description')
        self.assertEqual(set(self.post.tagging()), {'old-a', 'old-b'})
        self.assertEqual(self.post.url, original_url)
        self.assertEqual(self.post.published_date, original_published_date)
        self.assertEqual(self.post.series_id, original_series_id)
        self.assertEqual(
            (
                self.post.config.hide,
                self.post.config.advertise,
                self.post.config.block_comment,
                self.post.config.cover_layout,
            ),
            original_config,
        )

        undo_revision = EditHistory.objects.exclude(pk=target.pk).get()
        self.assertEqual(undo_revision.change_type, EditHistory.ChangeType.RESTORE)
        self.assertEqual(undo_revision.restored_from, target)
        self.assertEqual(undo_revision.title, 'Current title')
        self.assertEqual(undo_revision.content, '<p>Current body</p>')

        second_response = self.client.post(
            self.revision_url(f'/{target.id}/restore'),
            json.dumps({'expectedUpdatedDate': self.post.updated_date.isoformat()}),
            content_type='application/json',
        )
        self.assertFalse(second_response.json()['body']['restored'])
        self.assertEqual(EditHistory.objects.count(), 2)

    def test_restore_rejects_stale_or_legacy_revision_without_mutation(self):
        target = self.create_revision()
        stale_updated_date = self.post.updated_date.isoformat()
        PostService.update_post(self.post, title='Concurrent title')
        revision_count = EditHistory.objects.count()
        self.client.force_login(self.author)

        stale_response = self.client.post(
            self.revision_url(f'/{target.id}/restore'),
            json.dumps({'expectedUpdatedDate': stale_updated_date}),
            content_type='application/json',
        )

        self.assertEqual(stale_response.json()['status'], 'ERROR')
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'Concurrent title')
        self.assertEqual(EditHistory.objects.count(), revision_count)

        legacy = self.create_revision(change_type=EditHistory.ChangeType.LEGACY)
        legacy_response = self.client.post(
            self.revision_url(f'/{legacy.id}/restore'),
            json.dumps({'expectedUpdatedDate': self.post.updated_date.isoformat()}),
            content_type='application/json',
        )
        self.assertEqual(legacy_response.json()['status'], 'ERROR')
        self.post.refresh_from_db()
        self.assertEqual(self.post.title, 'Concurrent title')
