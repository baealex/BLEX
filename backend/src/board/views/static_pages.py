from django.shortcuts import render, get_object_or_404

from board.models import StaticPage
from board.services.agent_content_service import AgentContentService
from board.services.discovery_metadata_service import DiscoveryMetadataService


def custom_404_view(request, exception=None):
    """
    Custom 404 error page handler.
    """
    return render(request, 'board/404.html', status=404)


def static_page_view(request, slug):
    """
    Dynamic view for static pages created in admin.
    Accessible via /static/<slug>/ URLs.
    """
    # Get the page by slug, only if it's published
    page = get_object_or_404(StaticPage, slug=slug, is_published=True)
    metadata = DiscoveryMetadataService.build_static_page_metadata(page, request)

    context = {
        'page': page,
        'static_page_markdown_url': AgentContentService.build_static_page_markdown_url(page, request),
        **metadata,
    }

    response = render(request, 'board/pages/static_page.html', context)
    response['Link'] = AgentContentService.build_agent_link_header_for_markdown_url(
        context['static_page_markdown_url'],
        request,
    )
    response['X-Llms-Txt'] = AgentContentService.build_llms_txt_url(request)
    return response
