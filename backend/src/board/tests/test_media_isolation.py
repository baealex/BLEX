from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.test import SimpleTestCase, override_settings

from board.admin.utilities import (
    ImageCleanerService,
    UnsafeImageCleanupPathError,
)


class TestMediaIsolationTestCase(SimpleTestCase):
    def test_test_runner_uses_disposable_media_root(self):
        production_media_root = Path(
            settings.BASE_DIR,
            'resources',
            'media',
        ).resolve()
        test_media_root = Path(settings.MEDIA_ROOT).resolve()

        self.assertNotEqual(test_media_root, production_media_root)

        saved_name = default_storage.save(
            'test-isolation/probe.txt',
            ContentFile(b'isolated'),
        )
        try:
            self.assertTrue((test_media_root / saved_name).is_file())
            self.assertFalse((production_media_root / saved_name).exists())
        finally:
            default_storage.delete(saved_name)

    @override_settings(TESTING=True)
    def test_image_cleanup_rejects_workspace_media_during_tests(self):
        production_media_root = Path(
            settings.BASE_DIR,
            'resources',
            'media',
        )

        with override_settings(MEDIA_ROOT=production_media_root):
            with self.assertRaisesRegex(
                UnsafeImageCleanupPathError,
                'temporary MEDIA_ROOT',
            ):
                ImageCleanerService().clean_files([])

    def test_image_cleanup_rejects_paths_outside_media_root(self):
        outside_path = Path(settings.MEDIA_ROOT).parent / 'outside-media.txt'

        with self.assertRaisesRegex(
            UnsafeImageCleanupPathError,
            'outside MEDIA_ROOT',
        ):
            ImageCleanerService().clean_files([str(outside_path)])
