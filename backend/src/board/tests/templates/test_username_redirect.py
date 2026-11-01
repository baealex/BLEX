"""
Username redirect test for public author routes
Tests that old usernames redirect to current username on author, post, series, Markdown, and RSS URLs
"""
import datetime

from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import (
    Post,
    PostContent,
    PostConfig,
    Profile,
    Series,
    SiteSetting,
    UsernameChangeLog,
)
from board.services.user_service import UserService


class UsernameRedirectTestCase(TestCase):
    """Username redirect test for public author routes"""

    def setUp(self):
        """Set up test data"""
        self.client = Client()

        # Create user with editor role
        self.user = User.objects.create_user(
            username='currentusername',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=self.user,
            role=Profile.Role.EDITOR
        )

        # Create a post
        self.post = Post.objects.create(
            title='Test Post',
            url='test-post',
            author=self.user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=self.post,
            content_html='<p>Test content</p>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,

            advertise=False
        )

        # Create username change log (old username -> current username)
        UsernameChangeLog.objects.create(
            user=self.user,
            username='oldusername'
        )

    def test_redirect_old_username_to_current_username(self):
        """Test redirect from old username to current username"""
        # Access post with old username
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'oldusername',
                'post_url': 'test-post'
            })
        )

        # Should redirect (302) to current username
        self.assertEqual(response.status_code, 302)

        # Check redirect URL
        expected_url = reverse('post_detail', kwargs={
            'username': 'currentusername',
            'post_url': 'test-post'
        })
        self.assertRedirects(response, expected_url)

    def test_legacy_public_post_redirect_resolution_uses_one_query(self):
        """Legacy post ownership and public visibility should resolve together."""
        with self.assertNumQueries(1):
            username = UserService.get_public_post_redirect_username(
                'oldusername',
                'test-post',
            )

        self.assertEqual(username, 'currentusername')

    def test_no_redirect_with_current_username(self):
        """Test no redirect when accessing with current username"""
        # Access post with current username
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'currentusername',
                'post_url': 'test-post'
            })
        )

        # Should return 200 OK (no redirect)
        self.assertEqual(response.status_code, 200)

    def test_redirect_preserves_public_post_for_reader_owner(self):
        """Old username redirects are based on public post ownership, not current role."""
        # A demoted editor can have public posts while their current role is reader.
        reader_user = User.objects.create_user(
            username='currentreader',
            email='reader@example.com',
            password='testpass123'
        )
        Profile.objects.create(
            user=reader_user,
            role=Profile.Role.READER
        )

        # Create username change log for reader
        UsernameChangeLog.objects.create(
            user=reader_user,
            username='oldreader'
        )

        # Create post by reader
        reader_post = Post.objects.create(
            title='Reader Post',
            url='reader-post',
            author=reader_user,
            created_date=timezone.now(),
            published_date=timezone.now()
        )
        PostContent.objects.create(
            post=reader_post,
            content_html='<p>Reader content</p>'
        )
        PostConfig.objects.create(
            post=reader_post,
            hide=False,

            advertise=False
        )

        # Access post with old username
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'oldreader',
                'post_url': 'reader-post'
            })
        )

        # Public post URLs should keep redirecting after demotion.
        expected_url = reverse('post_detail', kwargs={
            'username': 'currentreader',
            'post_url': 'reader-post'
        })
        self.assertRedirects(response, expected_url)

    def test_multiple_username_changes(self):
        """Test with multiple username changes (only latest should work)"""
        # Create another username change log
        UsernameChangeLog.objects.create(
            user=self.user,
            username='veryoldusername'
        )

        # Access with very old username should also redirect
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'veryoldusername',
                'post_url': 'test-post'
            })
        )

        # Should redirect to current username
        self.assertEqual(response.status_code, 302)
        expected_url = reverse('post_detail', kwargs={
            'username': 'currentusername',
            'post_url': 'test-post'
        })
        self.assertRedirects(response, expected_url)

    def test_404_for_nonexistent_old_username(self):
        """Test 404 for username that never existed"""
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'neverexisted',
                'post_url': 'test-post'
            })
        )

        # Should return 404
        self.assertEqual(response.status_code, 404)

    def enable_aeo(self):
        setting = SiteSetting.get_instance()
        setting.aeo_enabled = True
        setting.save(update_fields=['aeo_enabled'])

    def add_public_series(self):
        series = Series.objects.create(
            owner=self.user,
            name='Test Series',
            url='test-series',
        )
        self.post.series = series
        self.post.save(update_fields=['series'])
        return series

    def test_author_routes_redirect_old_username(self):
        """Test author page, post list, series list, and RSS redirects from old username"""
        routes = [
            ('user_profile', ''),
            ('user_posts', '?page=1'),
            ('user_series', ''),
            ('user_rss_feed', ''),
        ]

        for view_name, query_string in routes:
            with self.subTest(view_name=view_name):
                response = self.client.get(
                    reverse(view_name, kwargs={'username': 'oldusername'}) + query_string
                )

                self.assertRedirects(
                    response,
                    reverse(view_name, kwargs={'username': 'currentusername'}) + query_string,
                )

    def test_series_routes_redirect_old_username(self):
        """Test series detail and series Markdown redirects from old username"""
        self.enable_aeo()
        self.add_public_series()

        for view_name in ('series_detail', 'series_markdown'):
            with self.subTest(view_name=view_name):
                response = self.client.get(reverse(view_name, kwargs={
                    'username': 'oldusername',
                    'series_url': 'test-series',
                }))

                self.assertRedirects(response, reverse(view_name, kwargs={
                    'username': 'currentusername',
                    'series_url': 'test-series',
                }))

    def test_post_markdown_redirects_old_username(self):
        """Test post Markdown redirect from old username"""
        self.enable_aeo()

        response = self.client.get(reverse('post_markdown', kwargs={
            'username': 'oldusername',
            'post_url': 'test-post',
        }))

        self.assertRedirects(response, reverse('post_markdown', kwargs={
            'username': 'currentusername',
            'post_url': 'test-post',
        }))

    def test_markdown_routes_do_not_redirect_when_aeo_is_disabled(self):
        """Test 404 without redirect for Markdown routes when AEO is disabled"""
        self.add_public_series()

        for path in (
            reverse('post_markdown', kwargs={'username': 'oldusername', 'post_url': 'test-post'}),
            reverse('series_markdown', kwargs={'username': 'oldusername', 'series_url': 'test-series'}),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_hidden_content_does_not_redirect_old_username(self):
        """Test 404 without redirect for hidden posts and series"""
        self.enable_aeo()
        series = self.add_public_series()
        Series.objects.filter(pk=series.pk).update(hide=True)
        PostConfig.objects.filter(post=self.post).update(hide=True)

        for path in (
            reverse('post_markdown', kwargs={'username': 'oldusername', 'post_url': 'test-post'}),
            reverse('series_detail', kwargs={'username': 'oldusername', 'series_url': 'test-series'}),
            reverse('series_markdown', kwargs={'username': 'oldusername', 'series_url': 'test-series'}),
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_reclaimed_old_username_keeps_author_routes(self):
        """Test author routes served by the user who took over the old username"""
        new_owner = User.objects.create_user(
            username='oldusername',
            email='new-owner@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=new_owner, role=Profile.Role.EDITOR)

        for view_name in ('user_profile', 'user_rss_feed'):
            with self.subTest(view_name=view_name):
                response = self.client.get(
                    reverse(view_name, kwargs={'username': 'oldusername'})
                )

                self.assertEqual(response.status_code, 200)

        self.assertIsNone(UserService.get_renamed_username('oldusername'))

    def test_renamed_username_resolves_to_latest_owner(self):
        """Test redirect to the last user who gave up a username"""
        later_owner = User.objects.create_user(
            username='laterowner',
            email='later@example.com',
            password='testpass123'
        )
        UsernameChangeLog.objects.create(
            user=later_owner,
            username='oldusername',
            created_date=timezone.now() + datetime.timedelta(minutes=1),
        )

        self.assertEqual(
            UserService.get_renamed_username('oldusername'),
            'laterowner',
        )
