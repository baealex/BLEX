from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import PermissionDenied

@login_required
def setting_overview(request):
    """
    Overview settings page view.
    Shows user's blog statistics, activities, and notifications in one unified dashboard.
    Combines the functionality of dashboard and notifications for better UX.
    Data is loaded asynchronously through island components for better performance.
    """
    context = {
        'active': 'overview',
    }
    return render(request, 'board/setting/setting_overview.html', context)

@login_required
def setting_dashboard(request):
    """
    Dashboard settings page view.
    DEPRECATED: Use setting_overview instead.
    Redirects to the new overview page for backward compatibility.
    """
    return redirect('setting_overview')


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
def setting_notify(request):
    """
    Notification settings page view.
    DEPRECATED: Use setting_overview instead.
    Redirects to the new overview page for backward compatibility.
    """
    return redirect('setting_overview')


@login_required
def setting_series(request):
    """
    Series management page view.
    Renders the series management template with user's series data.
    """
    context = {
        'active': 'series'
    }
    return render(request, 'board/setting/setting_series.html', context)


@login_required
def setting_posts(request):
    """
    Posts management page view.
    Renders the posts management template with user's posts data.
    """
    context = {
        'active': 'posts'
    }
    return render(request, 'board/setting/setting_posts.html', context)


@login_required
def setting_analytics(request):
    """
    Analytics settings page view.
    Allows users to set their analytics share URL for personal analytics.
    Only accessible by users with EDITOR or ADMIN role.
    """
    # Check if user has editor role or higher
    if not request.user.profile.is_editor():
        raise PermissionDenied("편집자 권한이 필요합니다.")

    if request.method == 'POST':
        analytics_share_url = request.POST.get('analytics_share_url', '').strip()

        # Update profile
        profile = request.user.profile
        profile.analytics_share_url = analytics_share_url
        profile.save()

        messages.success(request, '통계 설정이 저장되었습니다.')
        return redirect('setting_analytics')

    context = {
        'active': 'analytics'
    }
    return render(request, 'board/setting/setting_analytics.html', context)


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
    """
    context = {
        'active': 'forms'
    }
    return render(request, 'board/setting/setting_forms.html', context)


@login_required
def setting_temp_posts(request):
    """
    Temporary posts management page view.
    Renders the temporary posts management template with user's saved drafts.
    """
    context = {
        'active': 'temp_posts'
    }
    return render(request, 'board/setting/setting_temp_posts.html', context)
