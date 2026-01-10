from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import PermissionDenied

@login_required
@login_required
def setting_notify(request):
    """
    Notification settings page view.
    Replaces the previous overview page.
    """
    from board.models import Config, CONFIG_TYPE

    # Ensure config exists
    if not hasattr(request.user, 'config'):
        Config.objects.create(user=request.user)

    context = {
        'active': 'notify',
        'notify_settings': {
            'email': request.user.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT) or False,
            # Add other settings as needed based on ConfigMeta
        }
    }
    return render(request, 'board/setting/setting_notify.html', context)


@login_required
def setting_profile(request):
    """
    Profile settings page view.
    Renders the profile settings template with user profile data.
    """
    context = {
        'active': 'profile'
    }
    return render(request, 'board/setting/setting_profile.html', context)


@login_required
def setting_account(request):
    """
    Account settings page view.
    Renders the account settings template with user account data.
    """
    context = {
        'active': 'account'
    }
    return render(request, 'board/setting/setting_account.html', context)


@login_required
def setting_series(request):
    """
    Series management page view.
    Renders the series management template with user's series data.
    Only accessible by users with EDITOR or ADMIN role.
    """
    if not request.user.profile.is_editor():
        raise PermissionDenied("편집자 권한이 필요합니다.")

    context = {
        'active': 'series'
    }
    return render(request, 'board/setting/setting_series.html', context)


@login_required
def setting_posts(request):
    """
    Posts management page view.
    Renders the posts management template with user's posts data.
    Only accessible by users with EDITOR or ADMIN role.
    """
    if not request.user.profile.is_editor():
        raise PermissionDenied("편집자 권한이 필요합니다.")

    context = {
        'active': 'posts'
    }
    return render(request, 'board/setting/setting_posts.html', context)


@login_required
def setting_integration(request):
    """
    Integration settings page view.
    Renders the integration settings template with user's integration configurations.
    """
    context = {
        'active': 'integration'
    }
    return render(request, 'board/setting/setting_integration.html', context)


@login_required
def setting_forms(request):
    """
    Forms management page view.
    Renders the forms management template with user's saved forms.
    Only accessible by users with EDITOR or ADMIN role.
    """
    if not request.user.profile.is_editor():
        raise PermissionDenied("편집자 권한이 필요합니다.")

    context = {
        'active': 'forms'
    }
    return render(request, 'board/setting/setting_forms.html', context)


@login_required
def setting_temp_posts(request):
    """
    Temporary posts management page view.
    Renders the temporary posts management template with user's saved drafts.
    Only accessible by users with EDITOR or ADMIN role.
    """
    if not request.user.profile.is_editor():
        raise PermissionDenied("편집자 권한이 필요합니다.")

    context = {
        'active': 'temp_posts'
    }
    return render(request, 'board/setting/setting_temp_posts.html', context)


@login_required
def setting_banners(request):
    """
    Banner management page view.
    Renders the banner management template for managing blog banners.
    """
    context = {
        'active': 'banners'
    }
    return render(request, 'board/setting/setting_banners.html', context)
