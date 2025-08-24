from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib import messages

from board.models import Series

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
    Renders the notification settings template with user notification preferences.
    """
    context = {
        'active': 'notify'
    }
    return render(request, 'board/setting/setting_notify.html', context)


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
    Renders the analytics template with user's visitor statistics.
    """
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
def setting_invitation(request):
    """
    Invitation management page view.
    Renders the invitation management template with user's invitation codes.
    """
    context = {
        'active': 'invitation'
    }
    return render(request, 'board/setting/setting_invitation.html', context)


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
