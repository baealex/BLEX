from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.urls import reverse


@login_required
def settings(request, path=''):
    """
    Unified settings view that handles all settings/* routes.
    Uses SettingsApp island with TanStack Router for client-side routing.
    The router automatically handles URL parsing and routing on the client side.
    """
    # Get admin URL if user is staff
    admin_url = None
    if request.user.is_staff:
        admin_url = reverse('admin:index')

    context = {
        'is_editor': request.user.profile.is_editor(),
        'is_staff': request.user.is_staff,
        'admin_url': admin_url
    }

    return render(request, 'board/settings.html', context)
