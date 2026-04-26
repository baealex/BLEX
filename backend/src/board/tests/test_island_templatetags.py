import json
import os
import tempfile

from django.test import SimpleTestCase, override_settings

from board.templatetags import island


class ViteDevServerTemplateTagTestCase(SimpleTestCase):
    def test_dev_server_uses_fallback_url_before_info_file_exists(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            info_path = os.path.join(temp_dir, 'dev-server.json')

            with override_settings(
                USE_VITE_DEV_SERVER=True,
                VITE_DEV_SERVER_URL='http://localhost:8100',
                VITE_DEV_SERVER_INFO_PATH=info_path,
            ):
                self.assertEqual(
                    island.island_entry('src/island.tsx'),
                    'http://localhost:8100/src/island.tsx',
                )
                self.assertEqual(
                    island.island_css('styles/main.scss'),
                    'http://localhost:8100/styles/main.scss',
                )
                self.assertIn(
                    'http://localhost:8100/@vite/client',
                    str(island.vite_hmr_client()),
                )

    def test_dev_server_reads_actual_vite_port_from_info_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            info_path = os.path.join(temp_dir, 'dev-server.json')
            with open(info_path, 'w') as f:
                json.dump({'url': 'http://localhost:8101'}, f)

            with override_settings(
                USE_VITE_DEV_SERVER=True,
                VITE_DEV_SERVER_URL='http://localhost:8100',
                VITE_DEV_SERVER_INFO_PATH=info_path,
            ):
                self.assertEqual(
                    island.island_entry('src/island.tsx'),
                    'http://localhost:8101/src/island.tsx',
                )
                self.assertEqual(
                    island.island_css('styles/main.scss'),
                    'http://localhost:8101/styles/main.scss',
                )
                self.assertIn(
                    'http://localhost:8101/@react-refresh',
                    str(island.vite_hmr_client()),
                )
