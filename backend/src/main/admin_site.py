from django.contrib.admin import AdminSite
from django.urls import reverse


class BlexAdminSite(AdminSite):
    site_header = 'BLEX 관리자'
    site_title = 'BLEX Admin'
    index_title = '대시보드'
    empty_value_display = '-'

    model_name_overrides = {
        ('auth', 'User'): '사용자',
        ('auth', 'Group'): '그룹',
        ('admin', 'LogEntry'): 'Admin 감사 로그',
        ('sites', 'Site'): '사이트 도메인',
    }

    navigation_groups = (
        (
            'content',
            '콘텐츠',
            (
                ('board', 'Post'),
                ('board', 'Series'),
                ('board', 'Tag'),
                ('board', 'Comment'),
                ('board', 'PinnedPost'),
                ('board', 'EditRequest'),
                ('board', 'SiteNotice'),
                ('board', 'SiteBanner'),
            ),
        ),
        (
            'users',
            '사용자·권한',
            (
                ('auth', 'User'),
                ('auth', 'Group'),
                ('board', 'Profile'),
                ('board', 'Config'),
                ('board', 'UserConfigMeta'),
                ('board', 'UserLinkMeta'),
            ),
        ),
        (
            'integrations',
            '알림·연동',
            (
                ('board', 'Notify'),
                ('board', 'TelegramSync'),
                ('board', 'WebhookSubscription'),
                ('board', 'SocialAuth'),
                ('board', 'TwoFactorAuth'),
            ),
        ),
        (
            'operations',
            '감사·운영',
            (
                ('board', 'EditHistory'),
                ('admin', 'LogEntry'),
                ('board', 'EmailChange'),
                ('board', 'UsernameChangeLog'),
                ('board', 'Form'),
                ('board', 'ImageCache'),
                ('sites', 'Site'),
            ),
        ),
    )

    product_settings = (
        ('ProductSiteSettings', '사이트 기본 설정', '/admin-settings/site-settings'),
        ('ProductLoginSettings', '로그인·보안 설정', '/admin-settings/login'),
        ('ProductIntegrationSettings', '알림 연동 설정', '/admin-settings/integrations'),
        ('ProductSeoSettings', 'SEO·AEO 설정', '/admin-settings/seo-aeo'),
    )

    @staticmethod
    def _build_group(key, name, models):
        return {
            'name': name,
            'app_label': f'blex_{key}',
            'app_url': (
                models[0].get('admin_url')
                or reverse('admin:index')
            ),
            'has_module_perms': True,
            'models': models,
        }

    def _build_product_settings_group(self):
        models = [
            {
                'name': name,
                'object_name': object_name,
                'perms': {
                    'add': False,
                    'change': False,
                    'delete': False,
                    'view': True,
                },
                'admin_url': url,
                'add_url': None,
                'view_only': True,
            }
            for object_name, name, url in self.product_settings
        ]
        return self._build_group(
            'product-settings',
            '제품 설정',
            models,
        )

    def get_app_list(self, request, app_label=None):
        app_list = super().get_app_list(request, app_label)
        if app_label is not None:
            return app_list

        available_models = {
            (app['app_label'], model['object_name']): model
            for app in app_list
            for model in app['models']
        }
        for model_key, model_name in self.model_name_overrides.items():
            if model_key in available_models:
                available_models[model_key]['name'] = model_name
        grouped_apps = [self._build_product_settings_group()]

        for key, name, model_keys in self.navigation_groups:
            models = [
                available_models.pop(model_key)
                for model_key in model_keys
                if model_key in available_models
            ]
            if models:
                grouped_apps.append(
                    self._build_group(key, name, models),
                )

        if available_models:
            remaining_models = sorted(
                available_models.values(),
                key=lambda model: str(model['name']),
            )
            grouped_apps.append(
                self._build_group(
                    'other',
                    '기타',
                    remaining_models,
                ),
            )

        return grouped_apps
