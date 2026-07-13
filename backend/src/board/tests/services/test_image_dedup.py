import hashlib
from io import BytesIO
from unittest.mock import patch

from PIL import Image

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.utils import timezone

from board.models import User, Post, PostContent, PostConfig, Profile, Config
from board.services.post_image_service import (
    PostImageMutationResult,
    PostImageService,
)
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

    def test_compute_image_hash_uses_sha256(self):
        """이미지 해시 알고리즘이 SHA-256인지 확인"""
        img = self._create_test_image(color='yellow')
        expected_hash = hashlib.sha256(img.read()).hexdigest()

        self.assertEqual(PostService._compute_image_hash(img), expected_hash)

    @patch.object(PostImageService, 'compute_image_hash', return_value='a' * 64)
    def test_compute_image_hash_facade_delegates_once(self, mock_compute_hash):
        """기존 private 해시 helper는 새 서비스에 한 번만 위임"""
        image = self._create_test_image()

        result = PostService._compute_image_hash(image)

        self.assertEqual(result, 'a' * 64)
        mock_compute_hash.assert_called_once_with(image)

    def test_is_image_shared_no_other_posts(self):
        """다른 포스트가 이미지를 사용하지 않을 때"""
        post = Post.objects.create(
            url='shared-test-1',
            title='Test',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/test.jpg',
        )
        PostContent.objects.create(post=post, content_html='')
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
        PostContent.objects.create(post=post1, content_html='')
        PostConfig.objects.create(post=post1)

        post2 = Post.objects.create(
            url='shared-test-2b',
            title='Test B',
            author=self.user,
            published_date=timezone.now(),
            image='images/title/shared.jpg',
        )
        PostContent.objects.create(post=post2, content_html='')
        PostConfig.objects.create(post=post2)

        self.assertTrue(PostService._is_image_shared('images/title/shared.jpg', post1.pk))

    @patch.object(PostImageService, 'is_image_shared', return_value=True)
    def test_is_image_shared_facade_delegates_once(self, mock_is_shared):
        """기존 private 공유 확인 helper는 새 서비스에 한 번만 위임"""
        result = PostService._is_image_shared('images/title/shared.jpg', 42)

        self.assertTrue(result)
        mock_is_shared.assert_called_once_with('images/title/shared.jpg', 42)

    def test_post_image_service_returns_typed_noop_result(self):
        """이미지 입력이 없으면 명시적인 무변경 결과를 반환"""
        post = Post(author=self.user, title='No image mutation')

        result = PostImageService.set_image_with_dedup(post)

        self.assertEqual(
            result,
            PostImageMutationResult(
                changed=False,
                reused_existing=False,
                storage_file_deleted=False,
            ),
        )

    @patch.object(PostImageService, 'set_image_with_dedup')
    def test_set_image_with_dedup_facade_delegates_once(self, mock_set_image):
        """기존 private mutation helper는 호환 dependency와 함께 한 번만 위임"""
        post = Post(author=self.user, title='Facade delegation')
        image = self._create_test_image()

        result = PostService._set_image_with_dedup(post, image, True)

        self.assertIsNone(result)
        mock_set_image.assert_called_once_with(
            post,
            image,
            True,
            compute_image_hash=PostService._compute_image_hash,
            is_image_shared=PostService._is_image_shared,
        )

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
        PostContent.objects.create(post=existing_post, content_html='')
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
        PostContent.objects.create(post=post, content_html='')
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
        PostContent.objects.create(post=existing, content_html='')
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

    @patch('board.services.post_service.PostService._compute_image_hash')
    def test_set_image_with_dedup_does_not_reuse_self(self, mock_hash):
        """같은 포스트의 기존 이미지는 중복 이미지 후보에서 제외"""
        mock_hash.return_value = 'e' * 64

        post = Post.objects.create(
            url='self-dedup-current',
            title='Self Dedup Current',
            author=self.user,
            published_date=timezone.now(),
        )
        Post.objects.filter(pk=post.pk).update(
            image='images/title/current.jpg',
            image_hash='e' * 64,
        )
        post.refresh_from_db()
        PostContent.objects.create(post=post, content_html='')
        PostConfig.objects.create(post=post)

        new_image = self._create_test_image('same-content.jpg')

        with patch.object(default_storage, 'exists', return_value=True):
            with patch.object(post.image, 'delete') as mock_delete:
                PostService._set_image_with_dedup(post, image=new_image)

        self.assertEqual(post.image.name, 'images/title/current.jpg')
        self.assertFalse(mock_delete.called)
        self.assertFalse(getattr(post, '_skip_thumbnail', False))

    @patch('board.services.post_service.PostService._compute_image_hash')
    def test_set_image_with_dedup_preserves_shared_file_on_replace(self, mock_hash):
        """공유 중인 기존 이미지를 교체해도 스토리지 파일은 삭제하지 않음"""
        mock_hash.return_value = 'f' * 64
        post = Post.objects.create(
            url='shared-replace-current',
            title='Shared Replace Current',
            author=self.user,
            image='images/title/shared-replace.jpg',
            image_hash='a' * 64,
        )
        Post.objects.create(
            url='shared-replace-other',
            title='Shared Replace Other',
            author=self.user,
            image='images/title/shared-replace.jpg',
            image_hash='a' * 64,
        )
        current_image = post.image

        with patch.object(current_image, 'delete') as mock_delete:
            PostService._set_image_with_dedup(
                post,
                image=self._create_test_image('replacement.jpg'),
            )

        mock_delete.assert_not_called()
        self.assertEqual(post.image.name, 'replacement.jpg')
        self.assertEqual(post.image_hash, 'f' * 64)

    def test_set_image_with_dedup_preserves_shared_file_on_delete(self):
        """공유 중인 이미지를 포스트에서 제거해도 스토리지 파일은 유지"""
        post = Post.objects.create(
            url='shared-delete-current',
            title='Shared Delete Current',
            author=self.user,
            image='images/title/shared-delete.jpg',
            image_hash='a' * 64,
        )
        Post.objects.create(
            url='shared-delete-other',
            title='Shared Delete Other',
            author=self.user,
            image='images/title/shared-delete.jpg',
            image_hash='a' * 64,
        )
        current_image = post.image

        with patch.object(current_image, 'delete') as mock_delete:
            PostService._set_image_with_dedup(
                post,
                image_delete=True,
            )

        mock_delete.assert_not_called()
        self.assertFalse(post.image)
        self.assertEqual(post.image_hash, '')

    def test_set_image_with_dedup_propagates_current_storage_exists_error(self):
        """현재 파일 확인 실패 시 예외를 전파하고 이미지 상태를 보존"""
        image = self._create_test_image('same-hash.jpg')
        image_hash = PostService._compute_image_hash(image)
        post = Post.objects.create(
            url='storage-exists-current-error',
            title='Storage Exists Current Error',
            author=self.user,
            image='images/title/current-error.jpg',
            image_hash=image_hash,
        )

        with patch.object(
            post.image.storage,
            'exists',
            side_effect=OSError('storage unavailable'),
        ):
            with self.assertRaisesRegex(OSError, 'storage unavailable'):
                PostService._set_image_with_dedup(post, image=image)

        self.assertEqual(post.image.name, 'images/title/current-error.jpg')
        self.assertEqual(post.image_hash, image_hash)
        self.assertEqual(image.tell(), 0)

    @patch('board.services.post_service.PostService._compute_image_hash')
    def test_set_image_with_dedup_propagates_duplicate_storage_exists_error(self, mock_hash):
        """중복 후보 파일 확인 실패 시 기존 이미지 삭제나 교체를 하지 않음"""
        mock_hash.return_value = 'b' * 64
        post = Post.objects.create(
            url='storage-exists-duplicate-current',
            title='Storage Exists Duplicate Current',
            author=self.user,
            image='images/title/duplicate-current.jpg',
            image_hash='a' * 64,
        )
        Post.objects.create(
            url='storage-exists-duplicate-candidate',
            title='Storage Exists Duplicate Candidate',
            author=self.user,
            image='images/title/duplicate-candidate.jpg',
            image_hash='b' * 64,
        )
        current_image = post.image

        with patch.object(
            default_storage,
            'exists',
            side_effect=OSError('storage unavailable'),
        ):
            with patch.object(current_image, 'delete') as mock_delete:
                with self.assertRaisesRegex(OSError, 'storage unavailable'):
                    PostService._set_image_with_dedup(
                        post,
                        image=self._create_test_image('duplicate.jpg'),
                    )

        mock_delete.assert_not_called()
        self.assertEqual(post.image.name, 'images/title/duplicate-current.jpg')
        self.assertEqual(post.image_hash, 'a' * 64)

    def test_set_image_with_dedup_propagates_storage_delete_error(self):
        """스토리지 삭제 실패 시 예외를 전파하고 이미지 상태를 보존"""
        post = Post.objects.create(
            url='storage-delete-error',
            title='Storage Delete Error',
            author=self.user,
            image='images/title/delete-error.jpg',
            image_hash='c' * 64,
        )

        with patch.object(
            post.image.storage,
            'delete',
            side_effect=OSError('storage delete failed'),
        ):
            with self.assertRaisesRegex(OSError, 'storage delete failed'):
                PostService._set_image_with_dedup(post, image_delete=True)

        self.assertEqual(post.image.name, 'images/title/delete-error.jpg')
        self.assertEqual(post.image_hash, 'c' * 64)
