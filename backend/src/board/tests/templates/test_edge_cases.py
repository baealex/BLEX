from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostConfig, PostContent, Profile


class TemplateEdgeCaseTestCase(TestCase):
    """Template edge cases that are likely to regress in production."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=self.user, role=Profile.Role.EDITOR)

    def _create_post(
        self,
        *,
        title: str,
        url: str,
        published_date=None,
        series=None,
        image=None,
        meta_description='',
    ) -> Post:
        if published_date is None:
            published_date = timezone.now()

        post = Post.objects.create(
            title=title,
            url=url,
            author=self.user,
            published_date=published_date,
            series=series,
            image=image,
            meta_description=meta_description,
        )
        PostContent.objects.create(
            post=post,
            text_md='edge case content',
            text_html='<p>edge case content</p>',
        )
        PostConfig.objects.create(
            post=post,
            hide=False,
            advertise=False,
        )
        return post

    def test_author_profile_supports_special_username(self):
        """Profile route should support underscores and hyphens in username."""
        special_user = User.objects.create_user(
            username='user_test-123',
            email='special@example.com',
            password='testpass123',
        )
        Profile.objects.create(user=special_user, role=Profile.Role.EDITOR)

        response = self.client.get(
            reverse('user_profile', kwargs={'username': special_user.username})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['author'].username, 'user_test-123')

    def test_index_includes_unicode_post_title(self):
        """Index should render posts with mixed unicode title safely."""
        post = self._create_post(
            title='한글 제목 テスト 测试 🚀',
            url='unicode-edge-post',
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

        titles = [item.title for item in response.context['posts']]
        self.assertIn(post.title, titles)

    def test_index_invalid_sort_falls_back_to_latest_order(self):
        """Unknown sort option should still use latest-published ordering."""
        older = self._create_post(
            title='older-post',
            url='older-post',
            published_date=timezone.now() - timezone.timedelta(days=1),
        )
        newer = self._create_post(
            title='newer-post',
            url='newer-post',
            published_date=timezone.now(),
        )

        response = self.client.get(reverse('index') + '?sort=invalid_option')
        self.assertEqual(response.status_code, 200)

        posts = list(response.context['posts'])
        self.assertEqual(posts[0].id, newer.id)
        self.assertEqual(posts[1].id, older.id)

    def test_index_renders_post_with_optional_fields_empty(self):
        """Posts with empty optional fields should still be visible on index."""
        post = self._create_post(
            title='minimal-post',
            url='minimal-post',
            series=None,
            image=None,
            meta_description='',
        )

        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)

        matched = next((item for item in response.context['posts'] if item.id == post.id), None)
        self.assertIsNotNone(matched)
        self.assertIsNone(matched.series)
