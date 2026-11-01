from functools import wraps

from django.conf import settings
from django.contrib import messages
from django.http import Http404
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.translation import gettext

from board.services.api_permission_service import ApiPermissionService
from board.services.authoring_permission_service import AuthoringPermissionService
from board.services.user_service import UserService

def staff_member_required(view_func):
    """
    Decorator for views that checks that the user is a staff member,
    redirecting to the login page if necessary.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if settings.DEBUG:
            return view_func(request, *args, **kwargs)
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def api_editor_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        permission_error = ApiPermissionService.require_editor(request.user)
        if permission_error:
            return permission_error
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def api_editor_required_methods(methods):
    required_methods = {method.upper() for method in methods}

    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if request.method.upper() in required_methods:
                permission_error = ApiPermissionService.require_editor(request.user)
                if permission_error:
                    return permission_error
            return view_func(request, *args, **kwargs)
        return _wrapped_view

    return decorator


def editor_required(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')

        if not AuthoringPermissionService.is_active_editor(request.user):
            messages.error(
                request,
                gettext('Author access is required. Please contact an administrator.'),
            )
            return redirect('index')

        return view_func(request, *args, **kwargs)
    return _wrapped_view


def redirect_renamed_author(view_name):
    """Send a 404 on a retired @username route to the author's current name."""
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            try:
                return view_func(request, *args, **kwargs)
            except Http404:
                username = UserService.get_renamed_username(kwargs['username'])
                if not username:
                    raise

            url = reverse(view_name, kwargs={**kwargs, 'username': username})
            query_string = request.META.get('QUERY_STRING')
            return redirect(f'{url}?{query_string}' if query_string else url)
        return _wrapped_view

    return decorator
