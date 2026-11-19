from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlsplit

from django.db import OperationalError
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from board.models import Config, Post, PostConfig, PostShareLink, PostShareLinkDailyCount, Profile, User
from board.services.post_share_link_service import PostShareLinkService


@override_settings(SITE_URL='https://blog.example')
class PostShareLinkTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = User.objects.create_user(username='share-author')
        cls.other_author = User.objects.create_user(username='other-share-author')
        cls.reader = User.objects.create_user(username='share-reader')
        for author in (cls.author, cls.other_author):
            Profile.objects.create(user=author, role=Profile.Role.EDITOR)
            Config.objects.create(user=author)
        Profile.objects.create(user=cls.reader, role=Profile.Role.READER)
        Config.objects.create(user=cls.reader)
        cls.post = Post.objects.create(
            title='Shareable post',
            url='shareable-post',
            author=cls.author,
            published_date=timezone.now() - timedelta(days=1),
        )
        PostConfig.objects.create(post=cls.post)

    def setUp(self):
        self.client.force_login(self.author)
        self.links_url = f'/v1/users/@{self.author.username}/posts/{self.post.url}/share-links'

    def create_link(self, label='November newsletter'):
        response = self.client.post(self.links_url, {'label': label}, content_type='application/json')
        self.assertEqual(response.json()['status'], 'DONE')
        return PostShareLink.objects.get(pk=response.json()['body']['id'])

    def redirect_url(self, link):
        return f'/r/{link.token}'

    def update_link(self, link, changes):
        return self.client.patch(
            f'{self.links_url}/{link.pk}', changes, content_type='application/json',
        )

    def test_create_multiple_named_links_and_list_counts(self):
        first = self.create_link('  Newsletter  ')
        second = self.create_link('Threads')
        self.assertNotEqual(first.token, second.token)
        for link in (first, second):
            self.assertRegex(link.token, r'^[2-9a-hjkmnp-tv-z]{6}$')
        today = timezone.localdate()
        for days_ago, clicks in [(7, 2), (6, 3), (0, 5)]:
            PostShareLinkDailyCount.objects.create(
                link=first, day=today - timedelta(days=days_ago), clicks=clicks,
            )

        response = self.client.get(self.links_url)
        self.assertIn('no-store', response['Cache-Control'])
        result = response.json()['body']
        self.assertTrue(result['canCreate'])
        self.assertEqual(result['links'], [
            {
                'id': second.pk,
                'label': 'Threads',
                'url': f'https://blog.example{self.redirect_url(second)}',
                'isPaused': False,
                'recentClicks': 0,
                'totalClicks': 0,
            },
            {
                'id': first.pk,
                'label': 'Newsletter',
                'url': f'https://blog.example{self.redirect_url(first)}',
                'isPaused': False,
                'recentClicks': 8,
                'totalClicks': 10,
            },
        ])

    def test_retries_when_a_generated_token_already_exists(self):
        existing = PostShareLink.objects.create(post=self.post, token='n6w3yk', label='Newsletter')
        with patch.object(PostShareLinkService, 'generate_token', side_effect=[existing.token, 'k7m4px']):
            link = self.create_link('Threads')

        self.assertEqual(link.token, 'k7m4px')
        existing.refresh_from_db()
        self.assertEqual(existing.label, 'Newsletter')

    def test_only_the_post_author_can_manage_links(self):
        link = self.create_link()
        guest = Client()
        self.assertEqual(guest.get(self.links_url).json()['status'], 'ERROR')

        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(self.links_url).json()['status'], 'ERROR')

        self.client.force_login(self.other_author)
        self.assertEqual(self.client.get(self.links_url).status_code, 404)
        self.assertEqual(self.update_link(link, {'is_paused': True}).status_code, 404)
        self.assertEqual(
            self.client.post(self.links_url, {'label': 'Wrong author'}, content_type='application/json').status_code,
            404,
        )
        link.refresh_from_db()
        self.assertFalse(link.is_paused)

    def test_validate_create_and_update_payloads(self):
        for body in ({'label': ' '}, {'label': 'a' * 101}, {'label': 123}, {'url': 'https://example.org'}):
            with self.subTest(body=body):
                response = self.client.post(self.links_url, body, content_type='application/json')
                self.assertEqual(response.json()['status'], 'ERROR')
        self.assertFalse(PostShareLink.objects.exists())

        link = self.create_link()
        for body in ({'is_paused': 'false'}, {'is_paused': None}, {'label': ''}, {'url': 'https://example.org'}):
            with self.subTest(body=body):
                self.assertEqual(self.update_link(link, body).json()['status'], 'ERROR')
        link.refresh_from_db()
        self.assertEqual(link.label, 'November newsletter')
        self.assertFalse(link.is_paused)

    def test_anonymous_gets_redirect_and_aggregate_per_link(self):
        first = self.create_link()
        second = self.create_link('Threads')
        guest = Client()
        for link in (first, first, second):
            response = guest.get(self.redirect_url(link))
            self.assertRedirects(response, self.post.get_absolute_url(), fetch_redirect_response=False)
            self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(
            dict(PostShareLinkDailyCount.objects.values_list('link_id', 'clicks')),
            {first.pk: 2, second.pk: 1},
        )
        self.assertEqual(first.daily_counts.get().day, timezone.localdate())
        self.assertFalse(guest.cookies)

    def test_earlier_token_formats_still_redirect_and_count_clicks(self):
        guest = Client()
        for token in ('k7m4px2v', 'A_B-cD3eF4gH5iJ6kL7mN8'):
            with self.subTest(token=token):
                link = PostShareLink.objects.create(post=self.post, token=token, label='Earlier link')
                response = guest.get(self.redirect_url(link))

                self.assertRedirects(response, self.post.get_absolute_url(), fetch_redirect_response=False)
                self.assertEqual(link.daily_counts.get().clicks, 1)

    def test_redirects_preview_requests_without_recording_them(self):
        link = self.create_link()
        guest = Client()
        url = self.redirect_url(link)
        responses = [
            guest.head(url),
            guest.get(url, HTTP_USER_AGENT='Slackbot-LinkExpanding 1.0'),
            guest.get(url, HTTP_USER_AGENT='Mozilla/5.0 (compatible; Discordbot/2.0)'),
            guest.get(url, HTTP_SEC_PURPOSE='prefetch;prerender'),
            guest.get(url, HTTP_PURPOSE='prefetch'),
        ]
        for response in responses:
            self.assertRedirects(response, self.post.get_absolute_url(), fetch_redirect_response=False)
        self.assertFalse(link.daily_counts.exists())
        self.assertEqual(guest.post(url).status_code, 405)

    def test_rename_and_pause_without_changing_the_address(self):
        link = self.create_link()
        guest = Client()
        address = self.redirect_url(link)

        self.assertEqual(self.update_link(link, {'label': '  Renamed  ', 'is_paused': True}).json()['status'], 'DONE')
        summary = self.client.get(self.links_url).json()['body']['links'][0]
        self.assertEqual(summary['label'], 'Renamed')
        self.assertTrue(summary['isPaused'])
        self.assertEqual(urlsplit(summary['url']).path, address)
        paused = guest.get(address)
        self.assertEqual(paused.status_code, 404)
        self.assertIn('no-store', paused['Cache-Control'])
        self.assertFalse(link.daily_counts.exists())

        self.assertEqual(self.update_link(link, {'is_paused': False}).json()['status'], 'DONE')
        self.assertRedirects(guest.get(address), self.post.get_absolute_url(), fetch_redirect_response=False)
        self.assertEqual(link.daily_counts.get().clicks, 1)

    def test_share_link_follows_current_post_address(self):
        link = self.create_link()
        User.objects.filter(pk=self.author.pk).update(username='new-share-author')
        Post.objects.filter(pk=self.post.pk).update(url='new-post-address')

        self.assertRedirects(
            Client().get(self.redirect_url(link)),
            '/@new-share-author/new-post-address',
            fetch_redirect_response=False,
        )

    def test_existing_link_uses_public_post_visibility_at_request_time(self):
        link = self.create_link()
        guest = Client()
        address = self.redirect_url(link)

        PostConfig.objects.filter(post=self.post).update(hide=True)
        self.assertEqual(guest.get(address).status_code, 404)
        self.assertFalse(self.client.get(self.links_url).json()['body']['canCreate'])
        self.assertEqual(
            self.client.post(self.links_url, {'label': 'Private'}, content_type='application/json').json()['status'],
            'ERROR',
        )

        PostConfig.objects.filter(post=self.post).update(hide=False)
        Post.objects.filter(pk=self.post.pk).update(published_date=timezone.now() + timedelta(days=1))
        self.assertEqual(guest.get(address).status_code, 404)
        self.assertFalse(self.client.get(self.links_url).json()['body']['canCreate'])

        Post.objects.filter(pk=self.post.pk).update(published_date=None)
        self.assertEqual(guest.get(address).status_code, 404)

        Post.objects.filter(pk=self.post.pk).update(
            published_date=timezone.now() - timedelta(days=1),
            deleted_date=timezone.now(),
        )
        self.assertEqual(guest.get(address).status_code, 404)
        self.assertFalse(link.daily_counts.exists())

        Post.all_objects.filter(pk=self.post.pk).update(deleted_date=None)
        self.assertRedirects(guest.get(address), self.post.get_absolute_url(), fetch_redirect_response=False)

    def test_redirect_still_works_when_count_write_fails(self):
        link = self.create_link()
        with patch('board.services.post_share_link_service.connection') as count_connection:
            count_connection.cursor.side_effect = OperationalError('database busy')
            with self.assertLogs('board.services.post_share_link_service', level='WARNING'):
                response = Client().get(self.redirect_url(link))

        self.assertRedirects(response, self.post.get_absolute_url(), fetch_redirect_response=False)
        self.assertFalse(link.daily_counts.exists())
