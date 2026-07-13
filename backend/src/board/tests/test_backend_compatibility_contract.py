import ast
import inspect
import json
from importlib import import_module

from django.apps import apps
from django.test import SimpleTestCase, TestCase
from django.urls import URLPattern, resolve, reverse
from django.utils import timezone

import board.models as board_models
from board import urls as board_urls
from board.models import (
    Config,
    Post,
    PostConfig,
    PostContent,
    PostLikes,
    Profile,
    TwoFactorAuth,
    User,
)
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.auth_service import AuthService
from board.services.post_service import PostService
from board.views.api import v1 as api_v1


EXPECTED_ROUTE_CONTRACT = (
    ('', 'index', 'board.views.main.index'),
    ('interests', 'interested_posts', 'board.views.main.interested_posts'),
    ('setup', 'initial_setup', 'board.views.initial_setup.initial_setup_view'),
    ('login', 'login', 'board.views.auth.login_view'),
    ('sign', 'signup', 'board.views.auth.signup_view'),
    ('login/callback/<str:provider>', 'oauth_callback', 'board.views.oauth_callback.oauth_callback'),
    ('logout', 'logout', 'django.contrib.auth.views.LogoutView'),
    ('llms.txt', 'llms_txt', 'board.views.agent.llms_txt'),
    ('static/<path:slug>.md', 'static_page_markdown', 'board.views.agent.static_page_markdown'),
    ('static/<path:slug>', 'static_page', 'board.views.static_pages.static_page_view'),
    ('settings/', 'settings', 'board.views.settings.settings'),
    ('settings/<path:path>', 'settings_path', 'board.views.settings.settings'),
    ('admin-settings/', 'admin_settings', 'board.views.settings.admin_settings'),
    ('admin-settings/<path:path>', 'admin_settings_path', 'board.views.settings.admin_settings'),
    ('docs/developer-api', 'developer_api_docs', 'board.views.developer_api_docs.developer_api_docs'),
    (
        'docs/developer-api/quickstart',
        'developer_api_quickstart',
        'board.views.developer_api_docs.developer_api_quickstart',
    ),
    (
        'docs/developer-api/<slug:operation_id>',
        'developer_api_docs_detail',
        'board.views.developer_api_docs.developer_api_docs',
    ),
    ('like/<url>', 'like_post', 'board.views.post_actions.like_post'),
    ('@<username>/series', 'user_series', 'board.views.author.author_series'),
    ('@<username>/about', 'user_about', 'board.views.author.author_about'),
    ('@<username>/about/edit', 'user_about_edit', 'board.views.author.author_about_edit'),
    (
        '@<username>/partials/featured-posts',
        'user_featured_posts_partial',
        'board.views.author.author_featured_posts_partial',
    ),
    ('@<username>/series/<series_url>.md', 'series_markdown', 'board.views.agent.series_markdown'),
    ('@<username>/series/<series_url>', 'series_detail', 'board.views.series.series_detail'),
    ('@<username>/posts', 'user_posts', 'board.views.author.author_posts'),
    ('@<username>/<post_url>.md', 'post_markdown', 'board.views.agent.post_markdown'),
    ('@<username>/<post_url>/edit', 'post_edit', 'board.views.post.post_editor'),
    ('@<username>/<post_url>', 'post_detail', 'board.views.post.post_detail'),
    ('@<username>', 'user_profile', 'board.views.author.author_overview'),
    ('write', 'post_write', 'board.views.post.post_editor'),
    ('search', 'search', 'board.views.search.search_page'),
    ('tags', 'tag_list', 'board.views.tag.tag_list_view'),
    ('tag/<str:name>', 'tag_detail', 'board.views.tag.tag_detail_view'),
    ('sitemap.xml', 'sitemap', 'board.views.sitemap.sitemap_index_view'),
    ('<section>/sitemap.xml', 'sitemap_section', 'board.views.sitemap.sitemap_section_view'),
    ('rss', 'site_rss_feed', 'board.feeds.SitePostsFeed'),
    ('rss/@<username>', 'user_rss_feed', 'board.feeds.UserPostsFeed'),
    ('robots.txt', 'robots_txt', 'board.views.agent.robots_txt'),
    ('v1/login', None, 'board.views.api.v1.auth.login'),
    ('v1/logout', None, 'board.views.api.v1.auth.logout'),
    ('v1/sign', None, 'board.views.api.v1.auth.sign'),
    ('v1/sign/<social>', None, 'board.views.api.v1.auth.sign_social'),
    ('v1/social-providers', None, 'board.views.api.v1.auth.social_providers'),
    ('v1/auth/security', None, 'board.views.api.v1.auth.security'),
    ('v1/auth/security/verify', None, 'board.views.api.v1.auth.security_verify'),
    ('v1/developer-tokens', None, 'board.views.api.v1.developer_token.developer_tokens'),
    (
        'v1/developer-tokens/<int:token_id>',
        None,
        'board.views.api.v1.developer_token.developer_tokens',
    ),
    ('v1/setting/<path:parameter>', None, 'board.views.api.v1.setting.setting'),
    ('v1/search', None, 'board.views.api.v1.search.search'),
    ('v1/posts', None, 'board.views.api.v1.post.post_list'),
    ('v1/posts/<url>/comments', None, 'board.views.api.v1.post.post_comment_list'),
    ('v1/drafts', None, 'board.views.api.v1.draft.drafts_list'),
    ('v1/drafts/<url>', None, 'board.views.api.v1.draft.drafts_detail'),
    ('v1/comments', None, 'board.views.api.v1.comment.comment_list'),
    ('v1/comments/user', None, 'board.views.api.v1.comment.user_comment'),
    ('v1/comments/<int:id>', None, 'board.views.api.v1.comment.comment_detail'),
    ('v1/users/@<username>/heatmap', None, 'board.views.api.v1.author.get_author_heatmap'),
    ('v1/users/@<username>', None, 'board.views.api.v1.user.users'),
    ('v1/users/@<username>/posts/<url>', None, 'board.views.api.v1.post.user_posts'),
    (
        'v1/users/@<username>/posts/<url>/related',
        None,
        'board.views.api.v1.post.user_post_related',
    ),
    ('v1/users/@<username>/series', None, 'board.views.api.v1.series.user_series'),
    ('v1/users/@<username>/series/<url>', None, 'board.views.api.v1.series.user_series'),
    ('v1/users/@<username>/check-redirect', None, 'board.views.api.v1.user.check_redirect'),
    (
        'v1/users/@<username>/pinned-posts',
        None,
        'board.views.api.v1.pinned_post.pinned_posts',
    ),
    (
        'v1/users/@<username>/pinned-posts/order',
        None,
        'board.views.api.v1.pinned_post.pinned_posts_order',
    ),
    (
        'v1/users/@<username>/pinnable-posts',
        None,
        'board.views.api.v1.pinned_post.pinnable_posts',
    ),
    ('v1/series', None, 'board.views.api.v1.series.series_create_update'),
    ('v1/series/<int:series_id>', None, 'board.views.api.v1.series.series_detail'),
    ('v1/series/valid-posts', None, 'board.views.api.v1.series.posts_can_add_series'),
    ('v1/series/order', None, 'board.views.api.v1.series.series_order'),
    ('v1/report/error', None, 'board.views.api.v1.report.error_report'),
    ('v1/image', None, 'board.views.api.v1.image.image'),
    ('v1/forms', None, 'board.views.api.v1.form.forms_list'),
    ('v1/forms/<int:id>', None, 'board.views.api.v1.form.forms_detail'),
    ('v1/telegram/<parameter>', None, 'board.views.api.v1.telegram.telegram'),
    ('v1/banners', None, 'board.views.api.v1.banner.banner'),
    ('v1/banners/order', None, 'board.views.api.v1.banner.banner_order'),
    ('v1/banners/<int:banner_id>', None, 'board.views.api.v1.banner.banner'),
    ('v1/notices', None, 'board.views.api.v1.notice.notices'),
    ('v1/notices/<int:notice_id>', None, 'board.views.api.v1.notice.notices'),
    ('v1/global-notices', None, 'board.views.api.v1.global_notice.global_notices'),
    (
        'v1/global-notices/<int:notice_id>',
        None,
        'board.views.api.v1.global_notice.global_notices',
    ),
    ('v1/global-banners', None, 'board.views.api.v1.global_banner.global_banners'),
    (
        'v1/global-banners/order',
        None,
        'board.views.api.v1.global_banner.global_banner_order',
    ),
    (
        'v1/global-banners/<int:banner_id>',
        None,
        'board.views.api.v1.global_banner.global_banners',
    ),
    ('v1/site-settings', None, 'board.views.api.v1.site_setting.site_settings'),
    (
        'v1/site-settings/brand-assets',
        None,
        'board.views.api.v1.site_setting.site_setting_brand_assets',
    ),
    ('v1/login-settings', None, 'board.views.api.v1.login_setting.login_settings'),
    (
        'v1/integration-settings',
        None,
        'board.views.api.v1.integration_setting.integration_settings',
    ),
    ('v1/static-pages', None, 'board.views.api.v1.static_page.static_pages'),
    ('v1/static-pages/<int:page_id>', None, 'board.views.api.v1.static_page.static_pages'),
    ('v1/markdown', None, 'board.views.api.v1.markdown.markdown_to_html'),
    ('v1/admin/users', None, 'board.views.api.v1.user_management.managed_users'),
    (
        'v1/admin/users/<int:user_id>/role',
        None,
        'board.views.api.v1.user_management.managed_user_role',
    ),
    ('v1/admin/author-invites', None, 'board.views.api.v1.author_invite.author_invites'),
    (
        'v1/admin/author-invites/<int:invite_id>',
        None,
        'board.views.api.v1.author_invite.author_invite_detail',
    ),
    ('v1/utilities/stats', None, 'board.views.api.v1.utility.utility_stats'),
    ('v1/utilities/clean-tags', None, 'board.views.api.v1.utility.utility_clean_tags'),
    (
        'v1/utilities/clean-sessions',
        None,
        'board.views.api.v1.utility.utility_clean_sessions',
    ),
    ('v1/utilities/clean-logs', None, 'board.views.api.v1.utility.utility_clean_logs'),
    ('v1/utilities/clean-images', None, 'board.views.api.v1.utility.utility_clean_images'),
    ('v1/webhook/channels', None, 'board.views.api.v1.webhook.my_channels'),
    (
        'v1/webhook/channels/<int:channel_id>',
        None,
        'board.views.api.v1.webhook.delete_channel',
    ),
    ('v1/webhook/global-channels', None, 'board.views.api.v1.webhook.global_channels'),
    (
        'v1/webhook/global-channels/<int:channel_id>',
        None,
        'board.views.api.v1.webhook.delete_global_channel',
    ),
    ('v1/webhook/test', None, 'board.views.api.v1.webhook.test_channel'),
    ('api/developer/v1/openapi.json', 'openapi-json', None),
    ('api/developer/v1/docs', 'openapi-view', None),
    ('api/developer/v1/me', 'get_me', None),
    ('api/developer/v1/posts', 'list_posts', None),
    ('api/developer/v1/posts', 'create_post', None),
    ('api/developer/v1/posts/search', 'search_posts', None),
    ('api/developer/v1/posts/<post_id>', 'get_post', None),
    ('api/developer/v1/posts/<post_id>', 'update_post', None),
    ('api/developer/v1/posts/<post_id>', 'delete_post', None),
    ('api/developer/v1/posts/<post_id>/publish', 'publish_post', None),
    ('api/developer/v1/tags', 'list_tags', None),
    ('api/developer/v1/series', 'list_series', None),
    ('api/developer/v1/images', 'upload_image', None),
    ('api/developer/v1/', 'api-root', None),
)


EXPECTED_V1_API_EXPORTS = (
    'login',
    'logout',
    'sign',
    'sign_social',
    'social_providers',
    'security',
    'security_verify',
    'developer_tokens',
    'setting',
    'search',
    'post_list',
    'post_comment_list',
    'drafts_list',
    'drafts_detail',
    'comment_list',
    'user_comment',
    'comment_detail',
    'get_author_heatmap',
    'users',
    'user_posts',
    'user_post_related',
    'user_series',
    'check_redirect',
    'pinned_posts',
    'pinned_posts_order',
    'pinnable_posts',
    'series_create_update',
    'series_detail',
    'posts_can_add_series',
    'series_order',
    'error_report',
    'image',
    'forms_list',
    'forms_detail',
    'telegram',
    'banner',
    'banner_order',
    'notices',
    'global_notices',
    'global_banners',
    'global_banner_order',
    'site_settings',
    'site_setting_brand_assets',
    'login_settings',
    'integration_settings',
    'static_pages',
    'markdown_to_html',
    'managed_users',
    'managed_user_role',
    'author_invites',
    'author_invite_detail',
    'utility_stats',
    'utility_clean_tags',
    'utility_clean_sessions',
    'utility_clean_logs',
    'utility_clean_images',
    'my_channels',
    'delete_channel',
    'global_channels',
    'delete_global_channel',
    'test_channel',
)


EXPECTED_MODEL_TABLES = (
    ('Comment', 'board_comment'),
    ('EmailChange', 'board_emailchange'),
    ('UserConfigMeta', 'board_userconfigmeta'),
    ('Config', 'board_config'),
    ('Form', 'board_form'),
    ('ImageCache', 'board_imagecache'),
    ('Notify', 'board_notify'),
    ('Tag', 'board_tag'),
    ('Post', 'board_post'),
    ('PostContent', 'board_postcontent'),
    ('PostConfig', 'board_postconfig'),
    ('PostConfigMeta', 'board_postconfigmeta'),
    ('PinnedPost', 'board_pinnedpost'),
    ('PostLikes', 'board_post_likes'),
    ('UserLinkMeta', 'board_userlinkmeta'),
    ('Profile', 'board_profile'),
    ('Series', 'board_series'),
    ('SeriesConfigMeta', 'board_seriesconfigmeta'),
    ('TelegramSync', 'board_telegramsync'),
    ('TwoFactorAuth', 'board_twofactorauth'),
    ('DeveloperToken', 'board_developertoken'),
    ('DeveloperRequestLog', 'board_developerrequestlog'),
    ('EditHistory', 'board_edithistory'),
    ('EditRequest', 'board_editrequest'),
    ('WebhookSubscription', 'board_webhooksubscription'),
    ('UsernameChangeLog', 'board_usernamechangelog'),
    ('SocialAuthProvider', 'board_socialauthprovider'),
    ('SocialAuth', 'board_socialauth'),
    ('LoginSetting', 'board_loginsetting'),
    ('IntegrationSetting', 'board_integrationsetting'),
    ('SiteSetting', 'board_sitesetting'),
    ('StaticPage', 'board_staticpage'),
    ('SiteNotice', 'board_sitenotice'),
    ('SiteBanner', 'board_sitebanner'),
    ('AuthorInvite', 'board_authorinvite'),
)


EXPECTED_MODEL_EXPORTS = (
    'AuthorInvite',
    'BannerPosition',
    'BannerType',
    'Comment',
    'Config',
    'DeveloperRequestLog',
    'DeveloperToken',
    'EditHistory',
    'EditRequest',
    'EmailChange',
    'Form',
    'ImageCache',
    'IntegrationSetting',
    'LoginSetting',
    'Notify',
    'PinnedPost',
    'Post',
    'PostConfig',
    'PostConfigMeta',
    'PostContent',
    'PostLikes',
    'Profile',
    'Series',
    'SeriesConfigMeta',
    'SiteBanner',
    'SiteContentBase',
    'SiteContentScope',
    'SiteNotice',
    'SiteSetting',
    'SocialAuth',
    'SocialAuthProvider',
    'StaticPage',
    'Tag',
    'TelegramSync',
    'TwoFactorAuth',
    'UserConfigMeta',
    'UserLinkMeta',
    'UsernameChangeLog',
    'WebhookSubscription',
    'avatar_path',
    'cover_path',
    'create_description',
    'get_user_hex',
    'title_image_path',
)


REQUIRED = object()

EXPECTED_POST_SERVICE_SIGNATURES = {
    'create_post': (
        ('user', REQUIRED),
        ('title', REQUIRED),
        ('text_html', REQUIRED),
        ('subtitle', ''),
        ('description', ''),
        ('reserved_date_str', ''),
        ('series_url', ''),
        ('custom_url', ''),
        ('tag', ''),
        ('image', None),
        ('is_hide', False),
        ('is_advertise', False),
        ('content_type', 'html'),
        ('cover_layout', None),
        ('cover_image_position', None),
        ('cover_image_ratio', None),
    ),
    'update_post': (
        ('post', REQUIRED),
        ('title', None),
        ('subtitle', None),
        ('text_html', None),
        ('description', None),
        ('series_url', None),
        ('custom_url', None),
        ('tag', None),
        ('image', None),
        ('image_delete', False),
        ('is_hide', None),
        ('is_advertise', None),
        ('content_type', None),
        ('cover_layout', None),
        ('cover_image_position', None),
        ('cover_image_ratio', None),
        ('reserved_date_str', None),
    ),
    'create_draft': (
        ('user', REQUIRED),
        ('title', ''),
        ('text_html', ''),
        ('subtitle', ''),
        ('description', ''),
        ('series_url', ''),
        ('tag', ''),
        ('image', None),
        ('custom_url', ''),
        ('content_type', 'html'),
        ('cover_layout', None),
        ('cover_image_position', None),
        ('cover_image_ratio', None),
        ('reserved_date_str', None),
    ),
    'update_draft': (
        ('post', REQUIRED),
        ('title', None),
        ('text_html', None),
        ('subtitle', None),
        ('description', None),
        ('series_url', None),
        ('tag', None),
        ('image', None),
        ('image_delete', False),
        ('custom_url', None),
        ('content_type', None),
        ('cover_layout', None),
        ('cover_image_position', None),
        ('cover_image_ratio', None),
        ('reserved_date_str', None),
    ),
    'publish_draft': (
        ('post', REQUIRED),
        ('title', None),
        ('text_html', None),
        ('subtitle', None),
        ('description', None),
        ('series_url', None),
        ('custom_url', None),
        ('tag', None),
        ('image', None),
        ('image_delete', False),
        ('is_hide', False),
        ('is_advertise', False),
        ('reserved_date_str', ''),
        ('content_type', None),
        ('cover_layout', None),
        ('cover_image_position', None),
        ('cover_image_ratio', None),
    ),
    'get_post_detail': (('username', REQUIRED), ('url', REQUIRED), ('user', None)),
    'get_related_posts': (('post', REQUIRED),),
    'get_visible_series_posts': (('post', REQUIRED),),
    'get_user_drafts': (('user', REQUIRED),),
    'can_user_edit_post': (('user', REQUIRED), ('post', REQUIRED)),
    'can_user_delete_post': (('user', REQUIRED), ('post', REQUIRED)),
    'delete_post': (('post', REQUIRED),),
    'send_post_notifications': (('post', REQUIRED), ('post_config', REQUIRED)),
    '_compute_image_hash': (('image_file', REQUIRED),),
    '_is_image_shared': (('image_name', REQUIRED), ('exclude_post_id', REQUIRED)),
    '_set_image_with_dedup': (
        ('post', REQUIRED),
        ('image', None),
        ('image_delete', False),
    ),
}


def flatten_url_patterns(patterns, prefix=''):
    contract = []
    for pattern in patterns:
        route = prefix + str(pattern.pattern)
        if isinstance(pattern, URLPattern):
            lookup = None if route.startswith('api/developer/v1/') else pattern.lookup_str
            contract.append((route, pattern.name, lookup))
        else:
            contract.extend(flatten_url_patterns(pattern.url_patterns, route))
    return tuple(contract)


class URLCompatibilityContractTests(SimpleTestCase):
    def test_board_url_route_order_names_and_callbacks_are_stable(self):
        self.assertEqual(flatten_url_patterns(board_urls.urlpatterns), EXPECTED_ROUTE_CONTRACT)

    def test_ambiguous_public_routes_resolve_and_reverse_with_legacy_priority(self):
        cases = (
            ('/@alice/post.md', 'post_markdown', {'username': 'alice', 'post_url': 'post'}),
            ('/@alice/post/edit', 'post_edit', {'username': 'alice', 'post_url': 'post'}),
            (
                '/@alice/series/topic.md',
                'series_markdown',
                {'username': 'alice', 'series_url': 'topic'},
            ),
            ('/static/guide.md', 'static_page_markdown', {'slug': 'guide'}),
            ('/settings/profile', 'settings_path', {'path': 'profile'}),
            ('/posts/sitemap.xml', 'sitemap_section', {'section': 'posts'}),
            ('/docs/developer-api/quickstart', 'developer_api_quickstart', {}),
        )

        for path, url_name, kwargs in cases:
            with self.subTest(path=path):
                self.assertEqual(resolve(path).url_name, url_name)
                self.assertEqual(reverse(url_name, kwargs=kwargs), path)


class PythonImportCompatibilityContractTests(SimpleTestCase):
    def test_board_models_exports_and_database_tables_are_stable(self):
        for export_name in EXPECTED_MODEL_EXPORTS:
            with self.subTest(export_name=export_name):
                self.assertTrue(hasattr(board_models, export_name))

        model_tables = tuple(
            (model.__name__, model._meta.db_table)
            for model in apps.get_app_config('board').get_models()
        )
        self.assertEqual(model_tables, EXPECTED_MODEL_TABLES)

        for model_name, _ in EXPECTED_MODEL_TABLES:
            with self.subTest(model_name=model_name):
                exported_model = getattr(board_models, model_name)
                self.assertIs(apps.get_model('board', model_name), exported_model)

    def test_v1_url_endpoints_remain_available_from_package_facade(self):
        legacy_callbacks = {
            callback
            for route, _, callback in EXPECTED_ROUTE_CONTRACT
            if route.startswith('v1/') and callback is not None
        }

        for callback_path in legacy_callbacks:
            module_path, export_name = callback_path.rsplit('.', 1)
            with self.subTest(export_name=export_name):
                implementation = getattr(import_module(module_path), export_name)
                self.assertIs(getattr(api_v1, export_name), implementation)

    def test_v1_package_declares_only_registered_url_endpoints(self):
        registered_exports = tuple(dict.fromkeys(
            pattern.callback.__name__
            for pattern in board_urls.urlpatterns
            if (
                isinstance(pattern, URLPattern)
                and str(pattern.pattern).startswith('v1/')
            )
        ))

        self.assertEqual(api_v1.__all__, EXPECTED_V1_API_EXPORTS)
        self.assertEqual(registered_exports, EXPECTED_V1_API_EXPORTS)
        self.assertEqual(len(api_v1.__all__), len(set(api_v1.__all__)))

        for export_name in api_v1.__all__:
            with self.subTest(export_name=export_name):
                self.assertIs(
                    getattr(api_v1, export_name),
                    next(
                        pattern.callback
                        for pattern in board_urls.urlpatterns
                        if (
                            isinstance(pattern, URLPattern)
                            and str(pattern.pattern).startswith('v1/')
                            and pattern.callback.__name__ == export_name
                        )
                    ),
                )

    def test_v1_package_initializer_has_no_wildcard_imports(self):
        module_tree = ast.parse(inspect.getsource(api_v1))
        wildcard_imports = [
            node
            for node in ast.walk(module_tree)
            if (
                isinstance(node, ast.ImportFrom)
                and any(alias.name == '*' for alias in node.names)
            )
        ]

        self.assertEqual(wildcard_imports, [])

    def test_setting_post_management_facade_signatures_are_stable(self):
        setting_module = import_module('board.views.api.v1.setting')

        setting_parameters = tuple(inspect.signature(setting_module.setting).parameters.values())
        self.assertEqual(
            tuple(parameter.name for parameter in setting_parameters),
            ('request', 'parameter'),
        )
        self.assertTrue(all(
            parameter.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
            for parameter in setting_parameters
        ))

        response_parameters = tuple(
            inspect.signature(setting_module.get_post_management_response).parameters.values()
        )
        self.assertEqual(
            tuple(parameter.name for parameter in response_parameters),
            ('request', 'user', 'scheduled'),
        )
        self.assertTrue(all(
            parameter.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
            for parameter in response_parameters[:2]
        ))
        self.assertIs(response_parameters[2].kind, inspect.Parameter.KEYWORD_ONLY)
        self.assertIs(response_parameters[2].default, False)

    def test_auth_service_create_user_signature_is_stable(self):
        parameters = tuple(inspect.signature(AuthService.create_user).parameters.values())
        actual = tuple(
            (
                parameter.name,
                REQUIRED if parameter.default is inspect.Parameter.empty else parameter.default,
            )
            for parameter in parameters
        )
        self.assertEqual(actual, (
            ('username', REQUIRED),
            ('name', REQUIRED),
            ('email', REQUIRED),
            ('password', None),
            ('avatar_url', None),
        ))
        self.assertTrue(all(
            parameter.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
            for parameter in parameters
        ))

    def test_two_factor_facade_and_model_method_signatures_are_stable(self):
        expected_signatures = (
            (AuthService.create_totp_secret, ()),
            (AuthService.create_recovery_key, ()),
            (AuthService.verify_totp_token, ('user', 'token')),
            (AuthService.get_totp_qr_code, ('user',)),
            (TwoFactorAuth.has_been_a_day, ('self',)),
            (TwoFactorAuth.get_totp_secret, ('self',)),
            (TwoFactorAuth.verify_recovery_key, ('self', 'token')),
            (TwoFactorAuth.verify_totp, ('self', 'token')),
            (TwoFactorAuth.get_provisioning_uri, ('self',)),
        )

        for method, expected_names in expected_signatures:
            with self.subTest(method=method.__qualname__):
                parameters = tuple(inspect.signature(method).parameters.values())
                self.assertEqual(
                    tuple(parameter.name for parameter in parameters),
                    expected_names,
                )
                self.assertTrue(all(
                    parameter.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
                    for parameter in parameters
                ))

    def test_post_service_facade_parameter_names_order_and_defaults_are_stable(self):
        for method_name, expected_parameters in EXPECTED_POST_SERVICE_SIGNATURES.items():
            with self.subTest(method_name=method_name):
                parameters = tuple(inspect.signature(getattr(PostService, method_name)).parameters.values())
                actual = tuple(
                    (
                        parameter.name,
                        REQUIRED if parameter.default is inspect.Parameter.empty else parameter.default,
                    )
                    for parameter in parameters
                )
                self.assertEqual(actual, expected_parameters)
                self.assertTrue(all(
                    parameter.kind is inspect.Parameter.POSITIONAL_OR_KEYWORD
                    for parameter in parameters
                ))


class LegacyResponseCompatibilityContractTests(SimpleTestCase):
    def test_status_done_keeps_http_200_and_camel_case_body(self):
        response = StatusDone({'count_likes': 2, 'nested_value': {'post_url': 'legacy'}})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {
            'status': 'DONE',
            'body': {
                'countLikes': 2,
                'nestedValue': {'postUrl': 'legacy'},
            },
        })

    def test_status_error_keeps_http_200_error_code_and_camel_case_keys(self):
        response = StatusError(ErrorCode.NEED_LOGIN, '로그인이 필요합니다.')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {
            'status': 'ERROR',
            'errorCode': 'error:NL',
            'errorMessage': '로그인이 필요합니다.',
        })


class TemplateLikeCompatibilityContractTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='contract-author',
            password='testpass',
            email='contract@example.com',
        )
        Profile.objects.create(user=cls.user, role=Profile.Role.EDITOR)
        Config.objects.create(user=cls.user)
        cls.post = Post.objects.create(
            author=cls.user,
            title='Compatibility Contract',
            url='compatibility-contract',
            published_date=timezone.now(),
        )
        PostContent.objects.create(post=cls.post, content_html='<p>contract</p>')
        PostConfig.objects.create(post=cls.post)

    def test_like_requires_post_and_keeps_legacy_unauthenticated_error(self):
        get_response = self.client.get('/like/compatibility-contract')
        post_response = self.client.post('/like/compatibility-contract')

        self.assertEqual(get_response.status_code, 405)
        self.assertEqual(post_response.status_code, 401)
        self.assertEqual(json.loads(post_response.content), {
            'status': 'error',
            'message': 'Authentication required',
        })

    def test_like_toggle_keeps_snake_case_payload_and_database_state(self):
        self.client.force_login(self.user)

        liked_response = self.client.post('/like/compatibility-contract')
        self.assertEqual(liked_response.status_code, 200)
        self.assertEqual(json.loads(liked_response.content), {
            'status': 'done',
            'count_likes': 1,
            'has_liked': True,
        })
        self.assertTrue(PostLikes.objects.filter(user=self.user, post=self.post).exists())

        unliked_response = self.client.post('/like/compatibility-contract')
        self.assertEqual(unliked_response.status_code, 200)
        self.assertEqual(json.loads(unliked_response.content), {
            'status': 'done',
            'count_likes': 0,
            'has_liked': False,
        })
        self.assertFalse(PostLikes.objects.filter(user=self.user, post=self.post).exists())
