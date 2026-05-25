import json
import os
import tempfile

from django.template import Context, Template
from django.test import RequestFactory, SimpleTestCase, override_settings

from board.templatetags import island


class ViteDevServerTemplateTagTestCase(SimpleTestCase):
    def setUp(self):
        self.request_factory = RequestFactory()

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

    def test_dev_server_rewrites_loopback_host_to_request_host(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            info_path = os.path.join(temp_dir, 'dev-server.json')
            with open(info_path, 'w') as f:
                json.dump({'url': 'http://localhost:8107'}, f)

            request = self.request_factory.get('/', HTTP_HOST='192.168.219.106:8000')

            with override_settings(
                USE_VITE_DEV_SERVER=True,
                VITE_DEV_SERVER_URL='http://localhost:8100',
                VITE_DEV_SERVER_INFO_PATH=info_path,
                ALLOWED_HOSTS=['*'],
            ):
                self.assertEqual(
                    island.island_entry('src/island.tsx', request=request),
                    'http://192.168.219.106:8107/src/island.tsx',
                )
                self.assertEqual(
                    island.island_css('styles/main.scss', request=request),
                    'http://192.168.219.106:8107/styles/main.scss',
                )
                self.assertIn(
                    'http://192.168.219.106:8107/@vite/client',
                    str(island.vite_hmr_client(request=request)),
                )

    def test_dev_server_keeps_explicit_non_loopback_host(self):
        request = self.request_factory.get('/', HTTP_HOST='192.168.219.106:8000')

        with override_settings(
            USE_VITE_DEV_SERVER=True,
            VITE_DEV_SERVER_URL='http://devbox.local:8100',
            VITE_DEV_SERVER_INFO_PATH='',
            ALLOWED_HOSTS=['*'],
        ):
            self.assertEqual(
                island.island_entry('src/island.tsx', request=request),
                'http://devbox.local:8100/src/island.tsx',
            )

    def test_dev_server_template_tag_uses_request_host(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            info_path = os.path.join(temp_dir, 'dev-server.json')
            with open(info_path, 'w') as f:
                json.dump({'url': 'http://127.0.0.1:8109'}, f)

            request = self.request_factory.get('/', HTTP_HOST='192.168.219.106:8000')
            template = Template("{% load island %}{% island_entry 'src/island.tsx' %}")

            with override_settings(
                USE_VITE_DEV_SERVER=True,
                VITE_DEV_SERVER_URL='http://localhost:8100',
                VITE_DEV_SERVER_INFO_PATH=info_path,
                ALLOWED_HOSTS=['*'],
            ):
                self.assertEqual(
                    template.render(Context({'request': request})),
                    'http://192.168.219.106:8109/src/island.tsx',
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
