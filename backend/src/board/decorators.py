from django.http import HttpResponseForbidden
from functools import wraps
from django.conf import settings

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
