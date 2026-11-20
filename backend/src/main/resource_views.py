from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpRequest, HttpResponse
from django.utils._os import safe_join
from django.views.static import serve

from board.work_log_storage import PRIVATE_WORK_LOG_DIRECTORY


def serve_public_resource(request: HttpRequest, path: str, document_root: str) -> HttpResponse:
    requested = Path(safe_join(document_root, path)).resolve()
    private_roots = (
        Path(document_root) / 'media' / PRIVATE_WORK_LOG_DIRECTORY,
        Path(settings.MEDIA_ROOT) / PRIVATE_WORK_LOG_DIRECTORY,
    )
    if any(requested.is_relative_to(root.resolve()) for root in private_roots):
        raise Http404
    return serve(request, path, document_root=document_root)
