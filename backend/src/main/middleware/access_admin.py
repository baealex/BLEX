from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.http import Http404
from django.urls import reverse
from django.utils.deprecation import MiddlewareMixin


class AccessAdminOnlyStaff(MiddlewareMixin):
    def process_request(self, request):
        if request.path.startswith(reverse('admin:index')):
            if settings.DEBUG and not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            if not (request.user.is_active and request.user.is_staff):
                raise Http404
