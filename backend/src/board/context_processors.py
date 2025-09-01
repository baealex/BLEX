from django.conf import settings


def oauth_settings(request):
    """
    Add OAuth client IDs to template context
    """
    return {
        'GOOGLE_OAUTH_CLIENT_ID': getattr(settings, 'GOOGLE_OAUTH_CLIENT_ID', ''),
        'GITHUB_OAUTH_CLIENT_ID': getattr(settings, 'GITHUB_OAUTH_CLIENT_ID', ''),
    }
