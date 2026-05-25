import json
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import (
    Config,
    PinnedPost,
    Post,
    PostConfig,
    PostContent,
    Profile,
    Series,
    User,
)


class EditorDemotionPermissionTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(
            username='author',
            password='author',
            email='author@example.com',
        )
        Profile.objects.create(user=cls.author, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.author)

        cls.public_post = Post.objects.create(
            author=cls.author,
            title='Public Post',
            url='public-post',
            published_date=timezone.now() - timedelta(days=1),
        )
        PostContent.objects.create(post=cls.public_post, content_html='<p>Public content</p>')
        PostConfig.objects.create(post=cls.public_post, hide=False)

        cls.draft = Post.objects.create(
            author=cls.author,
            title='Draft Post',
            url='draft-post',
            published_date=None,
        )
        PostContent.objects.create(post=cls.draft, content_html='<p>Draft content</p>')
        PostConfig.objects.create(post=cls.draft, hide=False)

        cls.series = Series.objects.create(
            owner=cls.author,
            name='Public Series',
            url='public-series',
            text_md='Series',
            text_html='Series',
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'
        PinnedPost.objects.all().delete()

    def demote_author(self):
        profile = Profile.objects.get(user=self.author)
        profile.role = Profile.Role.READER
        profile.save(update_fields=['role'])

    def test_demoted_author_public_post_remains_visible(self):
        self.demote_author()

        response = self.client.get('/@author/public-post')

        self.assertEqual(response.status_code, 200)

    def test_demoted_author_does_not_see_post_edit_entrypoint(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        response = self.client.get('/@author/public-post')

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(
            response,
            reverse('post_edit', kwargs={
                'username': 'author',
                'post_url': 'public-post',
            }),
        )

    def test_demoted_author_cannot_update_existing_post(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        response = self.client.post('/v1/users/@author/posts/public-post', {
            'title': 'Changed',
            'text_html': '<p>Changed</p>',
        })

        self.public_post.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ERROR')
        self.assertEqual(response.json()['errorCode'], 'error:RJ')
        self.assertEqual(self.public_post.title, 'Public Post')

    def test_demoted_author_cannot_manage_drafts(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        list_response = self.client.get('/v1/drafts')
        update_response = self.client.put(
            '/v1/drafts/draft-post',
            json.dumps({'title': 'Changed', 'content': '<p>Changed</p>'}),
            content_type='application/json',
        )

        self.draft.refresh_from_db()
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(list_response.json()['status'], 'ERROR')
        self.assertEqual(list_response.json()['errorCode'], 'error:RJ')
        self.assertEqual(update_response.json()['status'], 'ERROR')
        self.assertEqual(update_response.json()['errorCode'], 'error:RJ')
        self.assertEqual(self.draft.title, 'Draft Post')

    def test_demoted_author_cannot_manage_series(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        list_response = self.client.get('/v1/series')
        update_response = self.client.put(
            f'/v1/series/{self.series.id}',
            json.dumps({'name': 'Changed'}),
            content_type='application/json',
        )

        self.series.refresh_from_db()
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(update_response.status_code, 200)
        self.assertEqual(list_response.json()['status'], 'ERROR')
        self.assertEqual(list_response.json()['errorCode'], 'error:RJ')
        self.assertEqual(update_response.json()['status'], 'ERROR')
        self.assertEqual(update_response.json()['errorCode'], 'error:RJ')
        self.assertEqual(self.series.name, 'Public Series')

    def test_demoted_author_cannot_manage_pinned_posts(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        response = self.client.post(
            '/v1/users/@author/pinned-posts',
            {'post_url': 'public-post'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ERROR')
        self.assertEqual(response.json()['errorCode'], 'error:RJ')
        self.assertFalse(PinnedPost.objects.exists())

    def test_demoted_author_cannot_access_editor_only_api_surfaces(self):
        self.demote_author()
        self.client.login(username='author', password='author')

        cases = [
            ('get', '/v1/webhook/channels', {}),
            (
                'post',
                '/v1/webhook/test',
                {
                    'data': json.dumps({'webhook_url': 'https://example.com/hook'}),
                    'content_type': 'application/json',
                },
            ),
            ('get', '/v1/forms', {}),
            ('post', '/v1/image', {}),
            (
                'post',
                '/v1/markdown',
                {
                    'data': json.dumps({'text': '# Title'}),
                    'content_type': 'application/json',
                },
            ),
            ('get', '/v1/setting/posts', {}),
        ]

        for method, path, kwargs in cases:
            with self.subTest(path=path):
                response = getattr(self.client, method)(path, **kwargs)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['status'], 'ERROR')
                self.assertEqual(response.json()['errorCode'], 'error:RJ')

    def test_scheduled_post_becomes_draft_when_author_is_demoted(self):
        scheduled = Post.objects.create(
            author=self.author,
            title='Scheduled Post',
            url='scheduled-post',
            published_date=timezone.now() + timedelta(days=1),
        )
        PostContent.objects.create(post=scheduled, content_html='<p>Scheduled</p>')
        PostConfig.objects.create(post=scheduled, hide=False)

        self.demote_author()

        scheduled.refresh_from_db()
        self.assertIsNone(scheduled.published_date)
