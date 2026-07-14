"""Stable package facade for the legacy v1 API endpoints."""

from .auth import (
    login,
    logout,
    security,
    security_verify,
    sign,
    sign_social,
    social_providers,
)
from .author_invite import author_invite_detail, author_invites
from .author import get_author_heatmap
from .banner import banner, banner_order
from .comment import comment_detail, comment_list, user_comment
from .developer_token import developer_tokens
from .draft import drafts_detail, drafts_list
from .form import forms_detail, forms_list
from .global_banner import global_banner_order, global_banners
from .global_notice import global_notices
from .image import image
from .integration_setting import integration_settings
from .login_setting import login_settings
from .notice import notices
from .markdown import markdown_to_html
from .pinned_post import pinnable_posts, pinned_posts, pinned_posts_order
from .post import post_comment_list, post_list, user_post_related, user_posts
from .post_revision import post_revisions, restore_post_revision
from .post_schedule import cancel_post_schedule, publish_scheduled_post_now
from .report import error_report
from .search import search
from .series import (
    posts_can_add_series,
    series_create_update,
    series_detail,
    series_order,
    user_series,
)
from .setting import setting
from .site_setting import site_setting_brand_assets, site_settings
from .static_page import static_pages
from .telegram import telegram
from .user import check_redirect, users
from .utility import (
    utility_clean_images,
    utility_clean_logs,
    utility_clean_sessions,
    utility_clean_tags,
    utility_stats,
)
from .user_management import managed_user_role, managed_users
from .webhook import (
    delete_channel,
    delete_global_channel,
    global_channels,
    my_channels,
    test_channel,
)


__all__ = (
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
    'post_revisions',
    'restore_post_revision',
    'cancel_post_schedule',
    'publish_scheduled_post_now',
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
