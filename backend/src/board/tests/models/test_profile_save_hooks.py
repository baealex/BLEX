from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from board.models import Profile, User


class ProfileSaveThumbnailHookTestCase(TestCase):
    """Characterization tests for Profile.save() avatar thumbnail side effects."""

    @staticmethod
    def create_test_image(name='avatar.jpg', color='red'):
        buffer = BytesIO()
        image = Image.new('RGB', (10, 10), color)
        image.save(buffer, 'JPEG')
        buffer.seek(0)
        return SimpleUploadedFile(name, buffer.read(), content_type='image/jpeg')

    def create_user(self, username='avatar-user'):
        return User.objects.create_user(
            username=username,
            password='test',
            email=f'{username}@test.com',
        )

    def test_new_profile_with_avatar_generates_thumbnail(self):
        user = self.create_user('new-avatar-user')

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    profile = Profile.objects.create(
                        user=user,
                        avatar=self.create_test_image(),
                    )

        mock_make_thumbnail.assert_called_once_with(profile, size=500)

    def test_profile_avatar_change_generates_thumbnail(self):
        user = self.create_user('changed-avatar-user')

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    profile = Profile.objects.create(
                        user=user,
                        avatar=self.create_test_image('old.jpg', color='blue'),
                    )
                    mock_make_thumbnail.reset_mock()

                    profile.avatar = self.create_test_image('new.jpg', color='green')
                    profile.save()

        mock_make_thumbnail.assert_called_once_with(profile, size=500)

    def test_profile_save_without_avatar_change_does_not_generate_thumbnail(self):
        user = self.create_user('unchanged-avatar-user')

        with TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=media_root):
                with patch('board.models.make_thumbnail') as mock_make_thumbnail:
                    profile = Profile.objects.create(
                        user=user,
                        avatar=self.create_test_image(),
                    )
                    mock_make_thumbnail.reset_mock()

                    profile.bio = 'updated bio'
                    profile.save()

        mock_make_thumbnail.assert_not_called()
