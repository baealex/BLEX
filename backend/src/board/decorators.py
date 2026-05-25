from functools import wraps

from django.conf import settings
from django.contrib import messages
from django.shortcuts import redirect

from board.services.api_permission_service import ApiPermissionService
from board.services.authoring_permission_service import AuthoringPermissionService

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
            messages.error(request, '편집자 권한이 필요합니다. 관리자에게 문의하세요.')
            return redirect('index')

        return view_func(request, *args, **kwargs)
    return _wrapped_view
