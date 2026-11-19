from collections.abc import Callable

from django.http import HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin
from django.utils.translation import gettext as _

from board.work_log_forms import WorkLogEntryForm


class WorkLogUploadLimitMiddleware(MiddlewareMixin):
    max_request_size = WorkLogEntryForm.max_media_size + 1024 * 1024

    def process_view(
        self, request: HttpRequest, view: Callable, args: tuple, kwargs: dict,
    ) -> HttpResponse | None:
        if request.method != 'POST' or request.resolver_match.url_name != 'work_log_add_entry':
            return None

        try:
            content_length = int(request.headers.get('Content-Length', '0'))
        except ValueError:
            return HttpResponse(status=400)

        if content_length > self.max_request_size:
            return HttpResponse(
                _('Choose an attachment up to 12 MB.'),
                status=413,
                content_type='text/plain; charset=utf-8',
            )
        return None
