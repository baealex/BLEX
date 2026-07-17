from django.contrib.admin import AdminSite
from django.urls import reverse
from django.utils.translation import gettext_lazy as _

from board.services.product_settings_permission_service import ProductSettingsPermissionService


class BlexAdminSite(AdminSite):
    site_header = _('BLEX administration')
    site_title = 'BLEX Admin'
    index_title = _('Dashboard')
    empty_value_display = '-'

    model_name_overrides = {
        ('auth', 'User'): _('Users'),
        ('auth', 'Group'): _('Groups'),
        ('admin', 'LogEntry'): _('Admin audit log'),
        ('sites', 'Site'): _('Site domains'),
    }

    navigation_groups = (
        (
            'content',
            _('Content'),
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
            _('Users and permissions'),
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
            _('Notifications and integrations'),
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
            _('Audit and operations'),
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
        (
            'ProductSiteSettings',
            _('Site settings'),
            '/admin-settings/site-settings',
            'can_manage_site_settings',
        ),
        (
            'ProductLoginSettings',
            _('Login and security settings'),
            '/admin-settings/login',
            'can_manage_login_settings',
        ),
        (
            'ProductIntegrationSettings',
            _('Notification integration settings'),
            '/admin-settings/integrations',
            'can_manage_integration_settings',
        ),
        (
            'ProductSeoSettings',
            _('SEO and AEO settings'),
            '/admin-settings/seo-aeo',
            'can_manage_site_settings',
        ),
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

    def _build_product_settings_group(self, request):
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
            for object_name, name, url, capability in self.product_settings
            if getattr(ProductSettingsPermissionService, capability)(request.user)
        ]
        if not models:
            return None

        return self._build_group(
            'product-settings',
            _('Product settings'),
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
        grouped_apps = []
        if product_settings_group := self._build_product_settings_group(request):
            grouped_apps.append(product_settings_group)

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
                    _('Other'),
                    remaining_models,
                ),
            )

        return grouped_apps
