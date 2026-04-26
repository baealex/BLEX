from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.urls import reverse


ADMIN_SETTINGS_PREFIXES = (
    'site-settings',
    'seo-aeo',
    'static-pages',
    'global-notices',
    'global-banners',
    'global-webhook',
    'utilities',
)


def _is_admin_settings_path(path):
    normalized_path = path.strip('/')
    return any(
        normalized_path == prefix or normalized_path.startswith(f'{prefix}/')
        for prefix in ADMIN_SETTINGS_PREFIXES
    )


def _build_settings_context(request, settings_mode, base_path):
    admin_url = None
    if request.user.is_staff:
        admin_url = reverse('admin:index')

    return {
        'is_editor': request.user.profile.is_editor(),
        'is_staff': request.user.is_staff,
        'admin_url': admin_url,
        'settings_mode': settings_mode,
        'settings_base_path': base_path,
        'settings_title': '관리자 설정' if settings_mode == 'admin' else '설정',
    }


@login_required
def settings(request, path=''):
    """
    Unified settings view that handles all settings/* routes.
    Uses SettingsApp island with TanStack Router for client-side routing.
    The router automatically handles URL parsing and routing on the client side.
    """
    if _is_admin_settings_path(path):
        if not request.user.is_staff:
            raise PermissionDenied
        return redirect(f'/admin-settings/{path}')

    context = _build_settings_context(request, 'user', '/settings')

    return render(request, 'board/settings.html', context)


@login_required
def admin_settings(request, path=''):
    """
    Staff-only settings view for site-wide administration pages.
    """
    if not request.user.is_staff:
        raise PermissionDenied

    context = _build_settings_context(request, 'admin', '/admin-settings')

    return render(request, 'board/settings.html', context)
