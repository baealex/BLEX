from tempfile import TemporaryDirectory

from django.test import override_settings
from django.test.runner import DiscoverRunner


class IsolatedMediaDiscoverRunner(DiscoverRunner):
    """Run the Django test suite with a disposable media directory."""

    def setup_test_environment(self, **kwargs) -> None:
        self.test_media_directory = TemporaryDirectory(
            prefix='blex-test-media-',
        )
        self.media_override = override_settings(
            MEDIA_ROOT=self.test_media_directory.name,
        )
        self.media_override.enable()

        try:
            super().setup_test_environment(**kwargs)
        except Exception:
            self.media_override.disable()
            self.test_media_directory.cleanup()
            raise

    def teardown_test_environment(self, **kwargs) -> None:
        try:
            super().teardown_test_environment(**kwargs)
        finally:
            self.media_override.disable()
            self.test_media_directory.cleanup()
