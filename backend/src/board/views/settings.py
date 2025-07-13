from django.shortcuts import render
from django.contrib.auth.decorators import login_required

from board.models import Series

@login_required
def setting_profile(request):
    """
    Profile settings page view.
    Renders the profile settings template with user profile data.
    """
    return render(request, 'board/setting_profile.html')


@login_required
def setting_account(request):
    """
    Account settings page view.
    Renders the account settings template with user account data.
    """
    return render(request, 'board/setting_account.html')


@login_required
def setting_notify(request):
    """
    Notification settings page view.
    Renders the notification settings template with user notification preferences.
    """
    return render(request, 'board/setting_notify.html')


@login_required
def setting_series(request):
    """
    Series management page view.
    Renders the series management template with user's series data.
    """
    return render(request, 'board/setting_series.html')


@login_required
def setting_posts(request):
    """
    Posts management page view.
    Renders the posts management template with user's posts data.
    """
    return render(request, 'board/setting_posts.html')


@login_required
def setting_analytics(request):
    """
    Analytics settings page view.
    Renders the analytics template with user's visitor statistics.
    """
    return render(request, 'board/setting_analytics.html')


@login_required
def setting_integration(request):
    """
    Integration settings page view.
    Renders the integration settings template with user's integration configurations.
    """
    return render(request, 'board/setting_integration.html')


@login_required
def setting_invitation(request):
    """
    Invitation management page view.
    Renders the invitation management template with user's invitation codes.
    """
    return render(request, 'board/setting_invitation.html')
