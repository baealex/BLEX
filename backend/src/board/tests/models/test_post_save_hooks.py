from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import call, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from board.models import Post, User


class PostSaveThumbnailHookTestCase(TestCase):
    """Characterization tests for Post.save() thumbnail side effects."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='thumbnail-author',
            password='test',
            email='thumbnail@test.com',
        )

    @staticmethod
    def create_test_image(name='cover.jpg', color='red'):
        buffer = BytesIO()
        image = Image.new('RGB', (10, 10), color)
        image.save(buffer, 'JPEG')
        buffer.seek(0)
        return SimpleUploadedFile(name, buffer.read(), content_type='image/jpeg')

    def assert_thumbnail_set_created(self, mock_make_thumbnail, post):
        self.assertEqual(mock_make_thumbnail.call_count, 3)
        mock_make_thumbnail.assert_has_calls([
            call(post, size=750, quality=50, thumbnail_type='preview'),
            call(post, size=750, quality=85, thumbnail_type='minify'),
            call(post, size=1920, quality=85),
        ])

    def test_new_post_with_image_generates_thumbnail_set(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    post = Post.objects.create(
                        author=self.user,
                        title='New image post',
                        url='new-image-post',
                        image=self.create_test_image(),
                    )

        self.assert_thumbnail_set_created(mock_make_thumbnail, post)

    def test_post_image_change_generates_thumbnail_set(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    post = Post.objects.create(
                        author=self.user,
                        title='Changed image post',
                        url='changed-image-post',
                        image=self.create_test_image('old.jpg', color='blue'),
                    )
                    mock_make_thumbnail.reset_mock()

                    post.image = self.create_test_image('new.jpg', color='green')
                    post.save()

        self.assert_thumbnail_set_created(mock_make_thumbnail, post)

    def test_post_save_without_image_change_does_not_generate_thumbnails(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    post = Post.objects.create(
                        author=self.user,
                        title='Unchanged image post',
                        url='unchanged-image-post',
                        image=self.create_test_image(),
                    )
                    mock_make_thumbnail.reset_mock()

                    post.title = 'Unchanged image post updated'
                    post.save()

        mock_make_thumbnail.assert_not_called()

    def test_skip_thumbnail_flag_disables_thumbnail_generation(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    post = Post(
                        author=self.user,
                        title='Skip thumbnail post',
                        url='skip-thumbnail-post',
                        image=self.create_test_image(),
                    )
                    post._skip_thumbnail = True
                    post.save()

        mock_make_thumbnail.assert_not_called()

    def test_skip_thumbnail_flag_disables_changed_image_thumbnail_generation(self):
        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    post = Post.objects.create(
                        author=self.user,
                        title='Skip changed thumbnail post',
                        url='skip-changed-thumbnail-post',
                        image=self.create_test_image('old.jpg', color='blue'),
                    )
                    mock_make_thumbnail.reset_mock()

                    post.image = self.create_test_image('new.jpg', color='green')
                    post._skip_thumbnail = True
                    post.save()

        mock_make_thumbnail.assert_not_called()
