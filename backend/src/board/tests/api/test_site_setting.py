import json
import shutil
import tempfile
from io import BytesIO

from django.test import TestCase, override_settings
from django.test.client import Client
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from PIL import Image

from board.models import User, Profile, SiteSetting, SocialAuthProvider
from board.services.brand_asset_service import BrandAssetService


@override_settings(SITE_URL='http://localhost:8000')
class SiteSettingAPITestCase(TestCase):
    """SiteSetting API endpoint tests"""

    @classmethod
    def setUpTestData(cls):
        cls.staff_user = User.objects.create_user(
            username='staffuser',
            password='test',
            email='staff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.staff_user)

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')
        self.media_root = tempfile.mkdtemp()
        self.media_override = override_settings(MEDIA_ROOT=self.media_root)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)

    def make_svg_upload(self, content=None, name='brand.svg'):
        svg = content or (
            b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            b'<rect width="64" height="64" fill="#111111"/>'
            b'</svg>'
        )
        return SimpleUploadedFile(name, svg, content_type='image/svg+xml')

    def make_png_upload(self, size, name=None, actual_size=None):
        image_size = actual_size or size
        image = Image.new('RGBA', (image_size, image_size), (24, 24, 24, 255))
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        return SimpleUploadedFile(
            name or f'logo{size}.png',
            buffer.getvalue(),
            content_type='image/png',
        )

    def make_ico_upload(self):
        image = Image.new('RGBA', (32, 32), (24, 24, 24, 255))
        buffer = BytesIO()
        image.save(buffer, format='ICO', sizes=[(16, 16), (32, 32)])
        return SimpleUploadedFile('favicon.ico', buffer.getvalue(), content_type='image/x-icon')

    def make_icon_upload_payload(self, svg_content=None):
        payload = {
            'asset_type': 'icon',
            'theme': 'default',
            'svg': self.make_svg_upload(content=svg_content, name='icon.svg'),
            'manifest': json.dumps({
                'version': 1,
                'pngSizes': list(BrandAssetService.REQUIRED_ICON_PNG_SIZES),
                'ico': True,
                'generatedBy': 'test',
            }),
            'favicon_ico': self.make_ico_upload(),
        }
        for size in BrandAssetService.REQUIRED_ICON_PNG_SIZES:
            payload[f'png_{size}'] = self.make_png_upload(size)
        return payload

    def test_get_settings_not_login(self):
        """비로그인 상태에서 사이트 설정 조회 시 에러 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        response = client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:NL')

    def test_get_settings_normal_user(self):
        """일반 유저가 사이트 설정 조회 시 권한 거부 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')
        response = client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_get_settings(self):
        """사이트 설정 조회 테스트 - 모든 필드 반환 확인"""
        response = self.client.get('/v1/site-settings')
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        body = content['body']
        self.assertIn('headerScript', body)
        self.assertIn('footerScript', body)
        self.assertIn('seoEnabled', body)
        self.assertTrue(body['seoEnabled'])
        self.assertIn('robotsTxtExtraRules', body)
        self.assertEqual(body['robotsTxtExtraRules'], '')
        self.assertIn('robotsTxtDefault', body)
        self.assertIn('User-agent: *', body['robotsTxtDefault'])
        self.assertIn('Disallow: /admin-settings/', body['robotsTxtDefault'])
        self.assertNotIn('# Custom rules', body['robotsTxtDefault'])
        self.assertIn('aeoEnabled', body)
        self.assertFalse(body['aeoEnabled'])
        self.assertEqual(body['siteName'], 'BLEX')
        self.assertFalse(body['hasCustomLogo'])
        self.assertFalse(body['hasCustomIcon'])
        self.assertIn('logoSvgUrl', body)
        self.assertIn('logoSvgDarkUrl', body)
        self.assertIn('faviconUrl', body)
        self.assertIn('128', body['iconPngUrls'])
        self.assertIn('256', body['iconPngUrls'])
        self.assertIn('512', body['iconPngUrls'])
        self.assertIn('updatedDate', body)

    def test_update_single_field(self):
        """사이트 설정 개별 필드 업데이트 테스트"""
        data = {
            'header_script': '<script>console.log("header")</script>',
        }
        response = self.client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['headerScript'], '<script>console.log("header")</script>')

        # DB에서 확인
        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, '<script>console.log("header")</script>')

    def test_update_multiple_fields(self):
        """사이트 설정 복수 필드 업데이트 테스트"""
        data = {
            'header_script': '<script>header</script>',
            'footer_script': '<script>footer</script>',
            'site_name': 'Custom Blog',
            'seo_enabled': False,
            'robots_txt_extra_rules': 'User-agent: ExampleBot\nDisallow: /private/',
            'aeo_enabled': True,
        }
        response = self.client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['headerScript'], '<script>header</script>')
        self.assertEqual(content['body']['footerScript'], '<script>footer</script>')
        self.assertEqual(content['body']['siteName'], 'Custom Blog')
        self.assertFalse(content['body']['seoEnabled'])
        self.assertEqual(content['body']['robotsTxtExtraRules'], 'User-agent: ExampleBot\nDisallow: /private/')
        self.assertIn('robotsTxtDefault', content['body'])
        self.assertIn('# AI agent entry point: http://localhost:8000/llms.txt', content['body']['robotsTxtDefault'])
        self.assertIn('Search indexing is disabled at runtime.', content['body']['robotsTxtDefault'])
        self.assertNotIn('# Custom rules', content['body']['robotsTxtDefault'])
        self.assertNotIn('User-agent: ExampleBot', content['body']['robotsTxtDefault'])
        self.assertTrue(content['body']['aeoEnabled'])

        setting = SiteSetting.get_instance()
        self.assertEqual(setting.site_name, 'Custom Blog')
        self.assertFalse(setting.seo_enabled)
        self.assertEqual(setting.robots_txt_extra_rules, 'User-agent: ExampleBot\nDisallow: /private/')
        self.assertTrue(setting.aeo_enabled)
    def test_public_social_providers_only_returns_enabled_configured_providers(self):
        """로그인 화면에는 사용 가능하고 Client ID/Secret이 있는 제공자만 내려준다."""
        SocialAuthProvider.objects.update_or_create(
            key='google',
            defaults={
                'is_enabled': True,
                'client_id': 'google-client-id',
                'client_secret': 'google-secret',
            }
        )
        SocialAuthProvider.objects.update_or_create(
            key='github',
            defaults={
                'is_enabled': True,
                'client_id': 'github-client-id',
                'client_secret': '',
            }
        )

        response = self.client.get('/v1/social-providers')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(len(content['body']), 1)
        self.assertEqual(content['body'][0]['key'], 'google')
        self.assertEqual(content['body'][0]['clientId'], 'google-client-id')
        self.assertNotIn('clientSecret', content['body'][0])

    def test_update_invalid_json_keeps_existing_fields(self):
        setting = SiteSetting.get_instance()
        setting.header_script = 'original header'
        setting.footer_script = 'original footer'
        setting.save()

        response = self.client.put(
            '/v1/site-settings',
            '{invalid',
            content_type='application/json'
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')

        setting.refresh_from_db()
        self.assertEqual(setting.header_script, 'original header')
        self.assertEqual(setting.footer_script, 'original footer')

    def test_singleton_behavior(self):
        """싱글톤 동작 확인 - 여러 번 저장해도 하나의 인스턴스"""
        data1 = {'header_script': 'first'}
        self.client.put(
            '/v1/site-settings',
            json.dumps(data1),
            content_type='application/json'
        )

        data2 = {'footer_script': 'second'}
        self.client.put(
            '/v1/site-settings',
            json.dumps(data2),
            content_type='application/json'
        )

        # 인스턴스가 하나만 존재해야 함
        self.assertEqual(SiteSetting.objects.count(), 1)

        # 두 번째 업데이트 후 첫 번째 값이 유지되어야 함
        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, 'first')
        self.assertEqual(setting.footer_script, 'second')

    def test_normal_user_cannot_update(self):
        """일반 유저가 사이트 설정 수정 불가 테스트"""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        data = {'header_script': 'unauthorized'}
        response = client.put(
            '/v1/site-settings',
            json.dumps(data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_staff_can_upload_logo_svg(self):
        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='logo.svg'),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomLogo'])
        self.assertTrue(content['body']['logoSvgUrl'].startswith('/resources/media/brand/logo/default/'))

        setting = SiteSetting.get_instance()
        self.assertTrue(setting.logo_svg.name.startswith('brand/logo/default/'))

    def test_replacing_default_logo_keeps_dark_logo(self):
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='logo.svg'),
        })
        dark_response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'dark',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    b'<rect width="64" height="64" fill="#ffffff"/>'
                    b'</svg>'
                ),
                name='logo-dark.svg',
            ),
        })
        self.assertEqual(json.loads(dark_response.content)['status'], 'DONE')

        setting = SiteSetting.get_instance()
        dark_path = setting.logo_svg_dark.name
        self.assertTrue(default_storage.exists(dark_path))

        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    b'<circle cx="32" cy="32" r="32" fill="#222222"/>'
                    b'</svg>'
                ),
                name='logo-next.svg',
            ),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomLogoDark'])
        self.assertEqual(content['body']['logoSvgDarkUrl'], BrandAssetService.media_url(dark_path))
        self.assertTrue(default_storage.exists(dark_path))

    def test_svg_common_metadata_attributes_are_allowed(self):
        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
                    b'class="brand-svg" data-name="brand icon" aria-label="Brand icon">'
                    b'<style type="text/css">.brand-shape{fill:url(\'#paint0\');opacity:.9}</style>'
                    b'<defs><linearGradient id="paint0"><stop offset="0" stop-color="#111111"/></linearGradient></defs>'
                    b'<g class="brand-mark" data-name="Layer 1">'
                    b'<rect class="brand-shape" width="64" height="64" style="stroke:#222222" fill="url(\'#paint0\')"/></g>'
                    b'</svg>'
                ),
                name='metadata-logo.svg',
            ),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomLogo'])

    def test_svg_style_with_external_reference_is_rejected(self):
        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    b'<style>.brand-shape{fill:url("https://example.com/paint.svg#paint0")}</style>'
                    b'<rect class="brand-shape" width="64" height="64"/></svg>'
                ),
                name='external-style-logo.svg',
            ),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

    def test_normal_user_cannot_upload_brand_asset(self):
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='normaluser', password='test')

        response = client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')

    def test_dangerous_svg_is_rejected_without_replacing_existing_asset(self):
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='safe-logo.svg'),
        })
        setting = SiteSetting.get_instance()
        existing_path = setting.logo_svg.name

        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
                    b'onload="alert(1)"><rect width="64" height="64"/></svg>'
                ),
                name='dangerous-logo.svg',
            ),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        setting.refresh_from_db()
        self.assertEqual(setting.logo_svg.name, existing_path)

    def test_svg_processing_instruction_is_rejected(self):
        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(
                content=(
                    b'<?xml-stylesheet type="text/css" href="https://example.com/brand.css"?>'
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    b'<rect width="64" height="64"/></svg>'
                ),
                name='stylesheet-logo.svg',
            ),
        })

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        setting = SiteSetting.get_instance()
        self.assertFalse(setting.logo_svg)

    def test_staff_can_upload_icon_with_generated_derivatives(self):
        response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(),
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomIcon'])
        self.assertTrue(content['body']['faviconUrl'].startswith('/resources/media/brand/icon/default/'))
        self.assertTrue(content['body']['iconPngUrls']['128'].startswith('/resources/media/brand/icon/default/'))
        self.assertTrue(content['body']['iconPngUrls']['256'].startswith('/resources/media/brand/icon/default/'))
        self.assertTrue(content['body']['iconPngUrls']['512'].startswith('/resources/media/brand/icon/default/'))

        setting = SiteSetting.get_instance()
        self.assertTrue(setting.icon_svg.name.startswith('brand/icon/default/'))
        self.assertIn('128', setting.icon_manifest['png'])
        self.assertIn('256', setting.icon_manifest['png'])
        self.assertIn('512', setting.icon_manifest['png'])
        self.assertTrue(setting.icon_manifest['ico'].endswith('favicon.ico'))

    def test_replacing_default_icon_keeps_dark_icon(self):
        upload_response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(),
        )
        self.assertEqual(json.loads(upload_response.content)['status'], 'DONE')
        dark_response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'icon',
            'theme': 'dark',
            'svg': self.make_svg_upload(
                content=(
                    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                    b'<rect width="64" height="64" fill="#ffffff"/>'
                    b'</svg>'
                ),
                name='icon-dark.svg',
            ),
        })
        self.assertEqual(json.loads(dark_response.content)['status'], 'DONE')

        setting = SiteSetting.get_instance()
        dark_path = setting.icon_svg_dark.name
        self.assertTrue(default_storage.exists(dark_path))

        response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(svg_content=(
                b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                b'<circle cx="32" cy="32" r="32" fill="#222222"/>'
                b'</svg>'
            )),
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomIconDark'])
        self.assertEqual(content['body']['iconSvgDarkUrl'], BrandAssetService.media_url(dark_path))
        self.assertTrue(default_storage.exists(dark_path))

    def test_icon_png_dimension_must_match_manifest_size(self):
        payload = self.make_icon_upload_payload()
        payload['png_32'] = self.make_png_upload(32, actual_size=16)

        response = self.client.post('/v1/site-settings/brand-assets', payload)

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        setting = SiteSetting.get_instance()
        self.assertFalse(setting.icon_svg)
        self.assertEqual(setting.icon_manifest, {})

    def test_same_hash_failed_icon_upload_keeps_existing_files(self):
        upload_response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(),
        )
        self.assertEqual(json.loads(upload_response.content)['status'], 'DONE')

        setting = SiteSetting.get_instance()
        existing_svg_path = setting.icon_svg.name
        existing_png_path = setting.icon_manifest['png']['32']
        existing_manifest = setting.icon_manifest.copy()
        self.assertTrue(default_storage.exists(existing_svg_path))
        self.assertTrue(default_storage.exists(existing_png_path))

        payload = self.make_icon_upload_payload()
        payload['png_32'] = self.make_png_upload(32, actual_size=16)
        response = self.client.post('/v1/site-settings/brand-assets', payload)

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:VA')

        setting.refresh_from_db()
        self.assertEqual(setting.icon_svg.name, existing_svg_path)
        self.assertEqual(setting.icon_manifest, existing_manifest)
        self.assertTrue(default_storage.exists(existing_svg_path))
        self.assertTrue(default_storage.exists(existing_png_path))

    def test_delete_default_icon_returns_to_fallback_assets(self):
        upload_response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(),
        )
        self.assertEqual(json.loads(upload_response.content)['status'], 'DONE')

        response = self.client.delete(
            '/v1/site-settings/brand-assets',
            json.dumps({'asset_type': 'icon', 'theme': 'default'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertFalse(content['body']['hasCustomIcon'])
        self.assertEqual(content['body']['faviconUrl'], '/resources/favicon.ico')
        self.assertEqual(content['body']['iconPngUrls']['128'], '/resources/logo128.png')
        self.assertEqual(content['body']['iconPngUrls']['256'], '/resources/logo256.png')
        self.assertEqual(content['body']['iconPngUrls']['512'], '/resources/logo512.png')

        setting = SiteSetting.get_instance()
        self.assertFalse(setting.icon_svg)
        self.assertEqual(setting.icon_manifest, {})

    def test_missing_custom_icon_files_fall_back_to_default_resources(self):
        upload_response = self.client.post(
            '/v1/site-settings/brand-assets',
            self.make_icon_upload_payload(),
        )
        self.assertEqual(json.loads(upload_response.content)['status'], 'DONE')

        setting = SiteSetting.get_instance()
        icon_paths = [
            setting.icon_svg.name,
            setting.icon_manifest['ico'],
            *setting.icon_manifest['png'].values(),
        ]
        BrandAssetService.delete_storage_files(icon_paths)

        response = self.client.get('/v1/site-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomIcon'])
        self.assertEqual(content['body']['iconSvgUrl'], '/resources/logo512.png')
        self.assertEqual(content['body']['faviconUrl'], '/resources/favicon.ico')
        self.assertEqual(content['body']['iconPngUrls']['128'], '/resources/logo128.png')
        self.assertEqual(content['body']['iconPngUrls']['256'], '/resources/logo256.png')
        self.assertEqual(content['body']['iconPngUrls']['512'], '/resources/logo512.png')

    def test_missing_custom_logo_files_fall_back_to_default_resources(self):
        response = self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='logo.svg'),
        })
        self.assertEqual(json.loads(response.content)['status'], 'DONE')

        setting = SiteSetting.get_instance()
        BrandAssetService.delete_storage_files([setting.logo_svg.name])

        response = self.client.get('/v1/site-settings')

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertTrue(content['body']['hasCustomLogo'])
        self.assertEqual(content['body']['logoSvgUrl'], '/resources/logob.svg')
        self.assertEqual(content['body']['logoSvgDarkUrl'], '/resources/logow.svg')
