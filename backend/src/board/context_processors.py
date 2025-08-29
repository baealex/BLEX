from django.conf import settings


def oauth_settings(request):
    """
    Add OAuth client IDs to template context
    """
    return {
        'GOOGLE_OAUTH_CLIENT_ID': getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', ''),
        'GITHUB_OAUTH_CLIENT_ID': getattr(settings, 'GITHUB_OAUTH_CLIENT_ID', ''),
    }


def custom_scripts(request):
    """
    Add custom scripts to template context
    """
    return {
        'CUSTOM_HEAD_SCRIPTS': getattr(settings, 'CUSTOM_HEAD_SCRIPTS', ''),
        'CUSTOM_BODY_SCRIPTS': getattr(settings, 'CUSTOM_BODY_SCRIPTS', ''),
    }