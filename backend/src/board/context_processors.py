from django.conf import settings
from django.urls import reverse

from board.models import (
    SiteNotice,
    SiteContentScope,
    SocialAuthProvider,
    StaticPage,
)
from board.services.brand_asset_service import BrandAssetService
from board.services.agent_content_service import AgentContentService
from board.services.site_url_service import SiteUrlService
from board.services.social_auth_provider_service import SocialAuthProviderService


def oauth_settings(request):
    """
    Add OAuth client IDs to template context
    """
    resolver_match = getattr(request, 'resolver_match', None)
    if resolver_match is not None and resolver_match.namespace == 'admin':
        return {}

    providers = {
        provider.key: provider
        for provider in SocialAuthProvider.objects.filter(
            key__in=SocialAuthProviderService.supported_keys(),
            is_enabled=True,
        ).only('key', 'client_id')
    }
    return {
        'GOOGLE_OAUTH_CLIENT_ID': providers.get('google').client_id
        if providers.get('google') else '',
        'GITHUB_OAUTH_CLIENT_ID': providers.get('github').client_id
        if providers.get('github') else '',
    }


def site_settings(request):
    """
    Add site-wide settings to template context
    """
    setting = AgentContentService.get_site_setting(request)
    return {
        'site_setting': setting,
        'site_brand': BrandAssetService.public_context(setting),
        'site_rss_feed_url': SiteUrlService.absolute_url(request, reverse('site_rss_feed')),
    }


def global_notices(request):
    """
    Add active global notices to template context
    """
    return {
        'global_notices': SiteNotice.objects.filter(
            scope=SiteContentScope.GLOBAL,
            is_active=True,
        ).order_by('-created_date'),
    }


def footer_pages(request):
    """
    Add published static pages marked for footer display
    """
    return {
        'footer_pages': StaticPage.objects.filter(
            is_published=True,
            show_in_footer=True
        ).order_by('order', 'slug'),
    }


def debug_mode(request):
    """
    Add debug mode to template context
    """
    return {
        'debug': settings.DEBUG,
    }


def admin_url_context(request):
    """
    Add admin URL to template context for staff users only.
    The admin path changes on every server restart for security.
    """
    from main.admin_path import get_admin_url

    if request.user.is_authenticated and request.user.is_staff:
        return {
            'admin_url': get_admin_url(),
        }
    return {}
