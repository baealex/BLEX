from django.test import TestCase

from board.admin.service import AdminDisplayService
from board.models import PostConfig


class AdminDisplayServiceTestCase(TestCase):
    def test_config_badges_handles_postconfig_without_notice_field(self):
        config = PostConfig()

        result = str(AdminDisplayService.config_badges(config))

        self.assertIn('-', result)

    def test_post_status_badges_handles_postconfig_without_notice_field(self):
        config = PostConfig()

        result = str(AdminDisplayService.post_status_badges(config))

        self.assertIn('공개', result)
