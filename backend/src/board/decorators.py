from django.http import HttpResponseForbidden
from django.shortcuts import redirect
from functools import wraps

def staff_member_required(view_func):
    """
    Decorator for views that checks that the user is a staff member,
    redirecting to the login page if necessary.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_staff:
            return view_func(request, *args, **kwargs)
        return HttpResponseForbidden("이 페이지는 현재 스태프만 접근 가능합니다.")
    return _wrapped_view
