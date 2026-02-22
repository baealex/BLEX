from io import BytesIO
from unittest.mock import patch

from PIL import Image

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.utils import timezone

from board.models import User, Post, PostContent, PostConfig, Profile, Config
from board.services.post_service import PostService


class ImageDedupTestCase(TestCase):
    """Image deduplication logic tests"""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='testuser',
            password='test',
            email='test@test.com',
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)

    @staticmethod
    def _create_test_image(name='test.jpg', size=(100, 100), color='red'):
        """Create a test image file"""
        buf = BytesIO()
        image = Image.new('RGB', size, color)
        image.save(buf, 'JPEG')
        buf.seek(0)
        return SimpleUploadedFile(
            name,
            buf.read(),
            content_type='image/jpeg'
        )

    def test_compute_image_hash_consistency(self):
        """동일 이미지의 해시가 일관적인지 확인"""
        img1 = self._create_test_image(color='blue')
        img2 = self._create_test_image(color='blue')

        hash1 = PostService._compute_image_hash(img1)
        hash2 = PostService._compute_image_hash(img2)

        self.assertEqual(hash1, hash2)
        self.assertEqual(len(hash1), 64)

    def test_compute_image_hash_different_images(self):
        """다른 이미지의 해시가 다른지 확인"""
        img1 = self._create_test_image(color='red')
        img2 = self._create_test_image(color='green')

        hash1 = PostService._compute_image_hash(img1)
        hash2 = PostService._compute_image_hash(img2)

        self.assertNotEqual(hash1, hash2)

    def test_compute_image_hash_resets_seek(self):
        """해시 계산 후 파일 포인터가 처음으로 돌아가는지 확인"""
        img = self._create_test_image()
        PostService._compute_image_hash(img)
        self.assertEqual(img.tell(), 0)

    def test_is_image_shared_no_other_posts(self):
        """다른 포스트가 이미지를 사용하지 않을 때"""
        post = Post.objects.create(
            url='shared-test-1',
            title='Test',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/test.jpg',
        )
        PostContent.objects.create(post=post, text_md='', text_html='')
        PostConfig.objects.create(post=post)

        self.assertFalse(PostService._is_image_shared('images/title/test.jpg', post.pk))

    def test_is_image_shared_with_other_posts(self):
        """다른 포스트가 같은 이미지를 사용할 때"""
        post1 = Post.objects.create(
            url='shared-test-2a',
            title='Test A',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/shared.jpg',
        )
        PostContent.objects.create(post=post1, text_md='', text_html='')
        PostConfig.objects.create(post=post1)

        post2 = Post.objects.create(
            url='shared-test-2b',
            title='Test B',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/shared.jpg',
        )
        PostContent.objects.create(post=post2, text_md='', text_html='')
        PostConfig.objects.create(post=post2)

        self.assertTrue(PostService._is_image_shared('images/title/shared.jpg', post1.pk))

    @patch('board.services.post_service.PostService._compute_image_hash')
    @patch('modules.thumbnail.make_thumbnail')
    def test_set_image_with_dedup_reuses_existing(self, mock_thumbnail, mock_hash):
        """중복 이미지 업로드 시 기존 파일 경로를 재사용"""
        mock_hash.return_value = 'a' * 64

        existing_post = Post.objects.create(
            url='dedup-existing',
            title='Existing',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/existing.jpg',
            image_hash='a' * 64,
        )
        PostContent.objects.create(post=existing_post, text_md='', text_html='')
        PostConfig.objects.create(post=existing_post)

        new_image = self._create_test_image()

        with patch.object(default_storage, 'exists', return_value=True):
            post = PostService.create_draft(
                user=self.user,
                title='Dedup Test',
                text_html='<p>test</p>',
                image=new_image,
            )

        self.assertEqual(post.image_hash, 'a' * 64)
        self.assertEqual(post.image.name, 'images/title/existing.jpg')
        self.assertTrue(getattr(post, '_skip_thumbnail', False))

    @patch('board.services.post_service.PostService._compute_image_hash')
    @patch('modules.thumbnail.make_thumbnail')
    def test_set_image_with_dedup_new_image(self, mock_thumbnail, mock_hash):
        """새 이미지 (중복 없음) 시 정상 저장"""
        mock_hash.return_value = 'b' * 64

        new_image = self._create_test_image(color='green')

        post = PostService.create_draft(
            user=self.user,
            title='New Image Test',
            text_html='<p>test</p>',
            image=new_image,
        )

        self.assertEqual(post.image_hash, 'b' * 64)
        self.assertTrue(post.image)
        self.assertNotEqual(post.image.name, '')

    def test_set_image_with_dedup_delete(self):
        """이미지 삭제 시 image_hash도 초기화"""
        post = Post.objects.create(
            url='dedup-delete-test',
            title='Delete Test',
            author=self.user,
            published_date=timezone.now(),
            image_hash='c' * 64,
        )
        PostContent.objects.create(post=post, text_md='', text_html='')
        PostConfig.objects.create(post=post)

        PostService._set_image_with_dedup(post, image=None, image_delete=True)

        self.assertEqual(post.image_hash, '')
        self.assertFalse(post.image)

    @patch('board.services.post_service.PostService._compute_image_hash')
    @patch('modules.thumbnail.make_thumbnail')
    def test_skip_thumbnail_on_reuse(self, mock_thumbnail, mock_hash):
        """중복 재사용 시 _skip_thumbnail이 True로 설정"""
        mock_hash.return_value = 'd' * 64

        existing = Post.objects.create(
            url='skip-thumb-existing',
            title='Existing',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/thumb-test.jpg',
            image_hash='d' * 64,
        )
        PostContent.objects.create(post=existing, text_md='', text_html='')
        PostConfig.objects.create(post=existing)

        new_image = self._create_test_image()

        with patch.object(default_storage, 'exists', return_value=True):
            post = PostService.create_draft(
                user=self.user,
                title='Skip Thumb Test',
                text_html='<p>test</p>',
                image=new_image,
            )

        self.assertEqual(post.image.name, 'images/title/thumb-test.jpg')
        self.assertTrue(getattr(post, '_skip_thumbnail', False))
