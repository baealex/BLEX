import json
import os
import tempfile
from io import BytesIO
from unittest.mock import patch, MagicMock

from PIL import Image
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile

from board.models import User, Config, Profile, ImageCache


class ImageUploadTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create active user
        cls.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@test.com',
            is_active=True
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

        # Create inactive user
        cls.inactive_user = User.objects.create_user(
            username='inactive',
            password='testpass',
            email='inactive@test.com',
            is_active=False
        )

    def setUp(self):
        self.client.defaults['HTTP_USER_AGENT'] = 'BLEX_TEST'

    def create_test_image(self, format='PNG', size=(100, 100), color='red'):
        """Create a test image file"""
        file = BytesIO()
        image = Image.new('RGB', size, color=color)
        image.save(file, format)
        file.seek(0)
        return file

    def create_test_gif(self):
        """Create a test GIF file"""
        file = BytesIO()
        image = Image.new('RGB', (100, 100), color='blue')
        image.save(file, 'GIF')
        file.seek(0)
        return file

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_upload_jpg_image(self):
        """JPG 이미지 업로드 테스트"""
        self.client.login(username='testuser', password='testpass')

        image_file = self.create_test_image(format='JPEG')
        uploaded_file = SimpleUploadedFile(
            "test_image.jpg",
            image_file.read(),
            content_type="image/jpeg"
        )

        with patch('board.views.api.v1.image.make_path') as mock_make_path:
            with patch('builtins.open', create=True) as mock_open:
                with patch('PIL.Image.open') as mock_pil:
                    mock_make_path.return_value = tempfile.gettempdir()
                    mock_open.return_value.__enter__ = lambda s: s
                    mock_open.return_value.__exit__ = MagicMock()
                    mock_open.return_value.write = MagicMock()

                    mock_img = MagicMock()
                    mock_img.convert = MagicMock(return_value=mock_img)
                    mock_img.thumbnail = MagicMock()
                    mock_img.filter = MagicMock(return_value=mock_img)
                    mock_img.save = MagicMock()
                    mock_pil.return_value = mock_img

                    response = self.client.post('/v1/image', {'image': uploaded_file})

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('url', content['body'])

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_upload_png_image(self):
        """PNG 이미지 업로드 테스트"""
        self.client.login(username='testuser', password='testpass')

        image_file = self.create_test_image(format='PNG')
        uploaded_file = SimpleUploadedFile(
            "test_image.png",
            image_file.read(),
            content_type="image/png"
        )

        with patch('board.views.api.v1.image.make_path') as mock_make_path:
            with patch('builtins.open', create=True):
                with patch('PIL.Image.open') as mock_pil:
                    with patch('os.stat') as mock_stat:
                        mock_make_path.return_value = tempfile.gettempdir()
                        mock_stat.return_value.st_size = 1024 * 100  # 100KB

                        mock_img = MagicMock()
                        mock_img.convert = MagicMock(return_value=mock_img)
                        mock_img.thumbnail = MagicMock()
                        mock_img.filter = MagicMock(return_value=mock_img)
                        mock_img.save = MagicMock()
                        mock_pil.return_value = mock_img

                        response = self.client.post('/v1/image', {'image': uploaded_file})

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertIn('url', content['body'])

    def test_upload_without_login(self):
        """로그인하지 않은 사용자의 이미지 업로드 차단"""
        image_file = self.create_test_image()
        uploaded_file = SimpleUploadedFile(
            "test.jpg",
            image_file.read(),
            content_type="image/jpeg"
        )

        response = self.client.post('/v1/image', {'image': uploaded_file})
        self.assertEqual(response.status_code, 404)

    def test_upload_with_inactive_user(self):
        """비활성 사용자의 이미지 업로드 차단"""
        self.client.login(username='inactive', password='testpass')

        image_file = self.create_test_image()
        uploaded_file = SimpleUploadedFile(
            "test.jpg",
            image_file.read(),
            content_type="image/jpeg"
        )

        response = self.client.post('/v1/image', {'image': uploaded_file})
        self.assertEqual(response.status_code, 404)

    def test_upload_without_image(self):
        """이미지 없이 업로드 시도 시 에러 발생"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.post('/v1/image', {})
        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')
        self.assertIn('이미지가 없습니다', content['errorMessage'])

    def test_upload_invalid_extension(self):
        """허용되지 않은 확장자 업로드 차단"""
        self.client.login(username='testuser', password='testpass')

        # Create a fake file with invalid extension
        invalid_file = SimpleUploadedFile(
            "test.bmp",
            b"fake image content",
            content_type="image/bmp"
        )

        with patch('board.views.api.v1.image.make_path') as mock_make_path:
            with patch('builtins.open', create=True):
                mock_make_path.return_value = tempfile.gettempdir()
                response = self.client.post('/v1/image', {'image': invalid_file})

        content = json.loads(response.content)
        self.assertNotEqual(content['status'], 'DONE')
        self.assertIn('허용된 확장자가 아닙니다', content['errorMessage'])

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_duplicate_image_uses_cache(self):
        """중복 이미지 업로드 시 캐시 사용"""
        self.client.login(username='testuser', password='testpass')

        image_file = self.create_test_image()
        content = image_file.read()

        # Create an image cache entry
        from modules.hash import get_sha256
        image_key = get_sha256(content)
        ImageCache.objects.create(
            key=image_key,
            path='images/cached/test.jpg',
            size=len(content)
        )

        uploaded_file = SimpleUploadedFile(
            "test.jpg",
            content,
            content_type="image/jpeg"
        )

        response = self.client.post('/v1/image', {'image': uploaded_file})
        self.assertEqual(response.status_code, 200)
        content_json = json.loads(response.content)
        self.assertIn('cached/test.jpg', content_json['body']['url'])

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    @patch('subprocess.run')
    def test_upload_gif_converts_to_mp4(self, mock_subprocess):
        """GIF 업로드 시 MP4로 변환"""
        self.client.login(username='testuser', password='testpass')

        gif_file = self.create_test_gif()
        uploaded_file = SimpleUploadedFile(
            "test.gif",
            gif_file.read(),
            content_type="image/gif"
        )

        with patch('board.views.api.v1.image.make_path') as mock_make_path:
            with patch('builtins.open', create=True):
                with patch('PIL.Image.open') as mock_pil:
                    with patch('os.remove'):
                        mock_make_path.return_value = tempfile.gettempdir()

                        mock_img = MagicMock()
                        mock_img.convert = MagicMock(return_value=mock_img)
                        mock_img.filter = MagicMock(return_value=mock_img)
                        mock_img.save = MagicMock()
                        mock_pil.return_value = mock_img
                        mock_subprocess.return_value = MagicMock()

                        response = self.client.post('/v1/image', {'image': uploaded_file})

        self.assertEqual(response.status_code, 200)

    @override_settings(MEDIA_ROOT=tempfile.gettempdir())
    def test_large_png_converts_to_jpg(self):
        """큰 PNG 파일은 JPG로 변환"""
        self.client.login(username='testuser', password='testpass')

        image_file = self.create_test_image(format='PNG', size=(2000, 2000))
        uploaded_file = SimpleUploadedFile(
            "large_image.png",
            image_file.read(),
            content_type="image/png"
        )

        with patch('board.views.api.v1.image.make_path') as mock_make_path:
            with patch('builtins.open', create=True):
                with patch('PIL.Image.open') as mock_pil:
                    with patch('os.stat') as mock_stat:
                        with patch('os.system'):
                            mock_make_path.return_value = tempfile.gettempdir()
                            # Simulate file size > 2MB
                            mock_stat.return_value.st_size = 1024 * 1024 * 3

                            mock_img = MagicMock()
                            mock_img.convert = MagicMock(return_value=mock_img)
                            mock_img.thumbnail = MagicMock()
                            mock_img.filter = MagicMock(return_value=mock_img)
                            mock_img.save = MagicMock()
                            mock_pil.return_value = mock_img

                            response = self.client.post('/v1/image', {'image': uploaded_file})

        self.assertEqual(response.status_code, 200)

    def test_invalid_method(self):
        """POST 이외의 메서드는 허용되지 않음"""
        self.client.login(username='testuser', password='testpass')

        response = self.client.get('/v1/image')
        self.assertEqual(response.status_code, 404)

        response = self.client.put('/v1/image')
        self.assertEqual(response.status_code, 404)
