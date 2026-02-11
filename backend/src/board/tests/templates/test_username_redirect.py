"""
Username redirect test for posts
Tests that old usernames redirect to current username when accessing posts
"""
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent, PostConfig, Profile, UsernameChangeLog


class UsernameRedirectTestCase(TestCase):
    """Username redirect test for posts"""

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
            text_md='Test content',
            text_html='<p>Test content</p>'
        )
        PostConfig.objects.create(
            post=self.post,
            hide=False,
            notice=False,
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

    def test_redirect_only_for_editors(self):
        """Test redirect only works for users with editor role"""
        # Create user without editor role
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
            text_md='Reader content',
            text_html='<p>Reader content</p>'
        )
        PostConfig.objects.create(
            post=reader_post,
            hide=False,
            notice=False,
            advertise=False
        )

        # Access post with old username
        response = self.client.get(
            reverse('post_detail', kwargs={
                'username': 'oldreader',
                'post_url': 'reader-post'
            })
        )

        # Should return 404 (no redirect for non-editors)
        self.assertEqual(response.status_code, 404)

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
