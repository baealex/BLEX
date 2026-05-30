from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render

from board.decorators import editor_required
from board.services.site_url_service import SiteUrlService


@editor_required
def developer_api_docs(request: HttpRequest, operation_id: str = '') -> HttpResponse:
    return redirect('/api/developer/v1/docs')


@editor_required
def developer_api_quickstart(request: HttpRequest) -> HttpResponse:
    return render(
        request,
        'board/developer_api_quickstart.html',
        {
            'site_origin': SiteUrlService.public_origin(request),
        },
    )
