from django.conf import settings
from board.models import SiteSetting, GlobalNotice


def oauth_settings(request):
    """
    Add OAuth client IDs to template context
    """
    return {
        'GOOGLE_OAUTH_CLIENT_ID': getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', ''),
        'GITHUB_OAUTH_CLIENT_ID': getattr(settings, 'GITHUB_OAUTH_CLIENT_ID', ''),
    }


def site_settings(request):
    """
    Add site-wide settings to template context
    """
    return {
        'site_setting': SiteSetting.get_instance(),
    }


def global_notices(request):
    """
    Add active global notices to template context
    """
    return {
        'global_notices': GlobalNotice.objects.filter(is_active=True).order_by('-created_date'),
    }
