import json
import shutil
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.test.client import Client
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.auth.models import Permission
from django.db import transaction
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from PIL import Image

from board.models import User, Profile, SiteSetting, SocialAuthProvider
from board.services.brand_asset_service import BrandAssetService
from board.services.social_auth_provider_service import SocialAuthProviderService


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
        site_setting_permission = Permission.objects.get(
            content_type__app_label='board',
            codename='change_sitesetting',
        )
        cls.staff_user.user_permissions.add(site_setting_permission)

        cls.superuser = User.objects.create_superuser(
            username='sitesuperuser',
            password='test',
            email='sitesuperuser@test.com',
        )

        cls.normal_user = User.objects.create_user(
            username='normaluser',
            password='test',
            email='normal@test.com',
        )
        Profile.objects.create(user=cls.normal_user)

        cls.restricted_staff = User.objects.create_user(
            username='restrictedstaff',
            password='test',
            email='restrictedstaff@test.com',
            is_staff=True,
        )
        Profile.objects.create(user=cls.restricted_staff)

    def setUp(self):
        self.client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.client.login(username='staffuser', password='test')
        self.superuser_client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        self.superuser_client.login(username='sitesuperuser', password='test')
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
        self.assertFalse(body['canManageScripts'])
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

    def test_superuser_can_update_global_code(self):
        """최고 관리자는 전역 코드를 수정할 수 있다."""
        data = {
            'header_script': '<script>console.log("header")</script>',
        }
        response = self.superuser_client.put(
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

    def test_superuser_can_update_multiple_site_setting_fields(self):
        """최고 관리자는 전역 코드와 일반 사이트 설정을 함께 수정할 수 있다."""
        data = {
            'header_script': '<script>header</script>',
            'footer_script': '<script>footer</script>',
            'site_name': 'Custom Blog',
            'seo_enabled': False,
            'robots_txt_extra_rules': 'User-agent: ExampleBot\nDisallow: /private/',
            'aeo_enabled': True,
        }
        response = self.superuser_client.put(
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

    def test_delegated_staff_cannot_read_or_update_global_code(self):
        """사이트 설정 권한만 가진 staff는 전역 코드를 보거나 수정할 수 없다."""
        setting = SiteSetting.get_instance()
        setting.header_script = '<script>keep-secret</script>'
        setting.footer_script = '<script>keep-footer</script>'
        setting.save()

        response = self.client.get('/v1/site-settings')

        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)['body']
        self.assertFalse(body['canManageScripts'])
        self.assertEqual(body['headerScript'], '')
        self.assertEqual(body['footerScript'], '')

        response = self.client.put(
            '/v1/site-settings',
            json.dumps({
                'site_name': 'Should not save',
                'header_script': '<script>replacement</script>',
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'ERROR')
        self.assertEqual(content['errorCode'], 'error:RJ')
        setting.refresh_from_db()
        self.assertEqual(setting.site_name, 'BLEX')
        self.assertEqual(setting.header_script, '<script>keep-secret</script>')
        self.assertEqual(setting.footer_script, '<script>keep-footer</script>')

    def test_delegated_staff_can_update_safe_site_setting_fields(self):
        """명시적 사이트 설정 권한은 안전한 브랜딩과 검색 설정에만 적용된다."""
        response = self.client.put(
            '/v1/site-settings',
            json.dumps({
                'site_name': 'Delegated Blog',
                'seo_enabled': False,
                'robots_txt_extra_rules': 'User-agent: ExampleBot',
                'aeo_enabled': True,
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        content = json.loads(response.content)
        self.assertEqual(content['status'], 'DONE')
        self.assertEqual(content['body']['siteName'], 'Delegated Blog')
        self.assertEqual(content['body']['headerScript'], '')

        setting = SiteSetting.get_instance()
        self.assertEqual(setting.site_name, 'Delegated Blog')
        self.assertFalse(setting.seo_enabled)
        self.assertEqual(setting.robots_txt_extra_rules, 'User-agent: ExampleBot')
        self.assertTrue(setting.aeo_enabled)

    def test_site_name_validation_uses_request_locale(self):
        for language, expected_message in (
            ('en', 'Site name must be 80 characters or fewer.'),
            ('ko', '사이트 이름은 80자 이하여야 합니다.'),
        ):
            with self.subTest(language=language):
                response = self.client.put(
                    '/v1/site-settings',
                    json.dumps({'site_name': 'x' * 81}),
                    content_type='application/json',
                    HTTP_ACCEPT_LANGUAGE=language,
                )

                self.assertEqual(response.status_code, 200)
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')
                self.assertEqual(content['errorMessage'], expected_message)

    def test_delegated_site_update_preserves_newer_global_code(self):
        """안전 필드 저장은 오래된 전역 코드 값을 다시 쓰지 않는다."""
        setting = SiteSetting.get_instance()
        setting.header_script = '<script>stale</script>'
        setting.save()
        original_get_instance = SiteSetting.get_instance

        def get_stale_setting():
            stale_setting = original_get_instance()
            SiteSetting.objects.filter(pk=stale_setting.pk).update(
                header_script='<script>protected</script>',
            )
            return stale_setting

        with patch(
            'board.views.api.v1.site_setting.SiteSetting.get_instance',
            side_effect=get_stale_setting,
        ):
            response = self.client.put(
                '/v1/site-settings',
                json.dumps({'site_name': 'Delegated Blog'}),
                content_type='application/json',
            )

        self.assertEqual(json.loads(response.content)['status'], 'DONE')
        setting.refresh_from_db()
        self.assertEqual(setting.site_name, 'Delegated Blog')
        self.assertEqual(setting.header_script, '<script>protected</script>')

    def test_site_setting_mutations_record_redacted_audit_entries(self):
        """설정 변경은 비밀값 없이 관리자 감사 로그에 남는다."""
        response = self.superuser_client.put(
            '/v1/site-settings',
            json.dumps({
                'site_name': 'Audited Blog',
                'header_script': '<script>do-not-log</script>',
            }),
            content_type='application/json',
        )

        self.assertEqual(json.loads(response.content)['status'], 'DONE')
        audit_log = LogEntry.objects.get(
            user=self.superuser,
            action_flag=CHANGE,
            change_message='Updated site settings',
        )
        self.assertEqual(audit_log.object_id, '1')
        self.assertNotIn('do-not-log', audit_log.change_message)

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

    def test_public_social_providers_uses_one_query(self):
        """공개 제공자 직렬화는 제공자 수와 무관하게 한 번만 조회한다."""
        SocialAuthProvider.objects.update_or_create(
            key='google',
            defaults={
                'is_enabled': True,
                'client_id': 'google-client-id',
                'client_secret': 'google-secret',
            },
        )
        SocialAuthProvider.objects.update_or_create(
            key='github',
            defaults={
                'is_enabled': True,
                'client_id': 'github-client-id',
                'client_secret': 'github-secret',
            },
        )

        with self.assertNumQueries(1):
            providers = SocialAuthProviderService.serialize_public_providers()

        self.assertEqual([provider['key'] for provider in providers], ['google', 'github'])

    def test_admin_social_providers_uses_one_query(self):
        """관리자 제공자 목록도 초기화용 쓰기 쿼리 없이 한 번만 조회한다."""
        SocialAuthProvider.objects.filter(key='github').delete()

        with self.assertNumQueries(1):
            providers = SocialAuthProviderService.serialize_admin_providers()

        self.assertEqual([provider['key'] for provider in providers], ['google', 'github'])
        github = next(provider for provider in providers if provider['key'] == 'github')
        self.assertFalse(github['is_enabled'])
        self.assertEqual(github['client_id'], '')
        self.assertFalse(SocialAuthProvider.objects.filter(key='github').exists())

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
        self.superuser_client.put(
            '/v1/site-settings',
            json.dumps(data1),
            content_type='application/json'
        )

        data2 = {'footer_script': 'second'}
        self.superuser_client.put(
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

    def test_staff_without_site_setting_permission_cannot_access_api(self):
        """is_staff만으로는 사이트 설정 API를 조회하거나 변경할 수 없다."""
        client = Client(HTTP_USER_AGENT='Mozilla/5.0')
        client.login(username='restrictedstaff', password='test')

        for method, payload in (
            ('get', None),
            ('put', json.dumps({'site_name': 'Unauthorized'})),
        ):
            with self.subTest(method=method):
                if method == 'get':
                    response = client.get(
                        '/v1/site-settings',
                        HTTP_ACCEPT_LANGUAGE='en',
                    )
                else:
                    response = client.put(
                        '/v1/site-settings',
                        payload,
                        content_type='application/json',
                        HTTP_ACCEPT_LANGUAGE='en',
                    )

                self.assertEqual(response.status_code, 200)
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:RJ')
                self.assertEqual(
                    content['errorMessage'],
                    'Permission to change site settings is required.',
                )

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

        self.assertTrue(LogEntry.objects.filter(
            user=self.staff_user,
            action_flag=CHANGE,
            change_message='Uploaded a brand asset',
        ).exists())

        setting = SiteSetting.get_instance()
        self.assertTrue(setting.logo_svg.name.startswith('brand/logo/default/'))

    def test_brand_asset_validation_uses_request_locale(self):
        for language, expected_message in (
            ('en', 'SVG file is required.'),
            ('ko', 'SVG 파일이 필요합니다.'),
        ):
            with self.subTest(language=language):
                response = self.client.post(
                    '/v1/site-settings/brand-assets',
                    {
                        'asset_type': 'logo',
                        'theme': 'default',
                    },
                    HTTP_ACCEPT_LANGUAGE=language,
                )

                self.assertEqual(response.status_code, 200)
                content = json.loads(response.content)
                self.assertEqual(content['status'], 'ERROR')
                self.assertEqual(content['errorCode'], 'error:VA')
                self.assertEqual(content['errorMessage'], expected_message)

    def test_brand_asset_upload_preserves_global_code_from_stale_instance(self):
        """브랜드 자산 저장은 오래된 인스턴스의 전역 코드를 저장하지 않는다."""
        stale_setting = SiteSetting.get_instance()
        stale_setting.header_script = '<script>stale</script>'
        stale_setting.save()
        SiteSetting.objects.filter(pk=stale_setting.pk).update(
            header_script='<script>protected</script>',
        )

        BrandAssetService.upload_asset(
            stale_setting,
            asset_type='logo',
            theme='default',
            svg_file=self.make_svg_upload(name='stale-logo.svg'),
            files={},
        )

        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, '<script>protected</script>')
        self.assertTrue(setting.logo_svg)

    def test_brand_asset_delete_preserves_global_code_from_stale_instance(self):
        """브랜드 자산 삭제도 오래된 인스턴스의 전역 코드를 저장하지 않는다."""
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='delete-stale-logo.svg'),
        })
        stale_setting = SiteSetting.get_instance()
        stale_setting.header_script = '<script>stale</script>'
        stale_setting.save()
        SiteSetting.objects.filter(pk=stale_setting.pk).update(
            header_script='<script>protected</script>',
        )

        BrandAssetService.delete_asset(
            stale_setting,
            asset_type='logo',
            theme='default',
        )

        setting = SiteSetting.get_instance()
        self.assertEqual(setting.header_script, '<script>protected</script>')
        self.assertFalse(setting.logo_svg)

    def test_brand_asset_upload_rolls_back_when_audit_record_fails(self):
        """감사 기록이 실패하면 새 브랜드 파일과 DB 변경을 남기지 않는다."""
        with patch(
            'board.views.api.v1.site_setting.AdminSettingsAuditService.record_change',
            side_effect=RuntimeError('audit failed'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit failed'):
                self.client.post('/v1/site-settings/brand-assets', {
                    'asset_type': 'logo',
                    'theme': 'default',
                    'svg': self.make_svg_upload(name='audit-failure-logo.svg'),
                })

        setting = SiteSetting.get_instance()
        self.assertFalse(setting.logo_svg)
        self.assertEqual(list(Path(self.media_root).rglob('*.svg')), [])

    def test_brand_asset_delete_rolls_back_when_audit_record_fails(self):
        """감사 기록이 실패하면 기존 브랜드 파일과 DB 경로를 유지한다."""
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='audit-delete-logo.svg'),
        })
        setting = SiteSetting.get_instance()
        logo_path = setting.logo_svg.name

        with patch(
            'board.views.api.v1.site_setting.AdminSettingsAuditService.record_change',
            side_effect=RuntimeError('audit failed'),
        ):
            with self.assertRaisesRegex(RuntimeError, 'audit failed'):
                self.client.delete(
                    '/v1/site-settings/brand-assets',
                    json.dumps({'asset_type': 'logo', 'theme': 'default'}),
                    content_type='application/json',
                )

        setting.refresh_from_db()
        self.assertEqual(setting.logo_svg.name, logo_path)
        self.assertTrue(default_storage.exists(logo_path))

    def test_brand_asset_replacement_keeps_old_storage_when_outer_transaction_rolls_back(self):
        """외부 트랜잭션이 실패하면 기존 자산 파일은 삭제하지 않는다."""
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='rollback-original-logo.svg'),
        })
        original_path = SiteSetting.get_instance().logo_svg.name

        with self.assertRaisesRegex(RuntimeError, 'force rollback'):
            with transaction.atomic():
                setting = SiteSetting.objects.select_for_update().get(pk=1)
                BrandAssetService.upload_asset(
                    setting,
                    asset_type='logo',
                    theme='default',
                    svg_file=self.make_svg_upload(name='rollback-replacement-logo.svg'),
                    files={},
                )
                raise RuntimeError('force rollback')

        setting = SiteSetting.get_instance()
        self.assertEqual(setting.logo_svg.name, original_path)
        self.assertTrue(default_storage.exists(original_path))

    def test_brand_asset_replacement_deletes_old_storage_after_commit(self):
        """이전 자산은 DB 변경이 커밋된 뒤에만 정리한다."""
        self.client.post('/v1/site-settings/brand-assets', {
            'asset_type': 'logo',
            'theme': 'default',
            'svg': self.make_svg_upload(name='commit-original-logo.svg'),
        })
        original_path = SiteSetting.get_instance().logo_svg.name

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/v1/site-settings/brand-assets', {
                'asset_type': 'logo',
                'theme': 'default',
                'svg': self.make_svg_upload(
                    content=(
                        b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
                        b'<circle cx="32" cy="32" r="32" fill="#222222"/>'
                        b'</svg>'
                    ),
                    name='commit-replacement-logo.svg',
                ),
            })
            self.assertEqual(json.loads(response.content)['status'], 'DONE')
            self.assertTrue(default_storage.exists(original_path))

        self.assertFalse(default_storage.exists(original_path))

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
