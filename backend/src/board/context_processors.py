from django.conf import settings
from board.models import SiteSetting, GlobalNotice, StaticPage


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

