from django.conf import settings
from board.models import SiteSetting


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
