from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from board.models import (
    Comment, Config, Post, PostConfig, PostContent, PostLikes, Profile, User
)
from board.services.user_heatmap_service import UserHeatmapService


class UserHeatmapServiceTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='heatmap-user', password='test')
        Config.objects.create(user=self.user)
        Profile.objects.create(user=self.user, role=Profile.Role.EDITOR)

    def create_post(self, url, published_date=None, hide=False):
        post = Post.objects.create(
            url=url,
            title=url,
            author=self.user,
            published_date=published_date or timezone.now(),
        )
        PostContent.objects.create(post=post, content_html='<p>content</p>')
        PostConfig.objects.create(post=post, hide=hide)
        return post

    def test_settings_heatmap_counts_posts_comments_and_likes(self):
        post = self.create_post('heatmap-post', hide=True)
        Comment.objects.create(
            post=post,
            author=self.user,
            text_md='comment',
            text_html='<p>comment</p>',
        )
        PostLikes.objects.create(post=post, user=self.user)
        date_key = timezone.now().date().strftime('%Y-%m-%d')

        heatmap = UserHeatmapService.get_settings_heatmap(self.user)

        self.assertEqual(heatmap[date_key], 3)
        self.assertEqual(
            cache.get(f'user_heatmap_{self.user.id}'),
            heatmap,
        )

    def test_settings_heatmap_uses_cache(self):
        post = self.create_post('cached-heatmap-post')
        date_key = timezone.now().date().strftime('%Y-%m-%d')

        first_heatmap = UserHeatmapService.get_settings_heatmap(self.user)
        PostLikes.objects.create(post=post, user=self.user)
        second_heatmap = UserHeatmapService.get_settings_heatmap(self.user)

        self.assertEqual(first_heatmap[date_key], 1)
        self.assertEqual(second_heatmap[date_key], 1)
