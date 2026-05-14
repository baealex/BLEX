from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.test import TestCase, override_settings

from board.models import Post, PostContent, User
from board.modules.read_time import calc_read_time


class PostContentSaveHookTestCase(TestCase):
    """Characterization tests for PostContent.save() parent post side effects."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='content-author',
            password='test',
            email='content@test.com',
        )

    def test_content_save_updates_parent_read_time_from_content_html(self):
        post = Post.objects.create(
            author=self.user,
            title='Read time post',
            url='read-time-post',
            read_time=99,
        )
        content_html = '<p>' + 'word ' * 500 + '</p>'

        PostContent.objects.create(post=post, content_html=content_html)

        post.refresh_from_db()
        self.assertEqual(post.read_time, calc_read_time(content_html))

    def test_content_save_without_post_image_does_not_generate_post_thumbnails(self):
        post = Post.objects.create(
            author=self.user,
            title='No thumbnail post',
            url='no-thumbnail-post',
        )

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.services.post_thumbnail_service.make_thumbnail') as mock_make_thumbnail:
                    PostContent.objects.create(post=post, content_html='<p>content</p>')

        mock_make_thumbnail.assert_not_called()

    def test_content_update_refreshes_parent_read_time(self):
        post = Post.objects.create(
            author=self.user,
            title='Read time update post',
            url='read-time-update-post',
        )
        content = PostContent.objects.create(post=post, content_html='<p>short</p>')
        updated_content_html = '<p>' + 'word ' * 700 + '</p>'

        content.content_html = updated_content_html
        content.save()

        post.refresh_from_db()
        self.assertEqual(post.read_time, calc_read_time(updated_content_html))
