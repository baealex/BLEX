import json

from django.shortcuts import render
from django.urls import reverse

from board.services.discovery_metadata_service import DiscoveryMetadataService


def search_page(request):
    username = request.GET.get('username', '').strip()

    props = {}
    if username:
        props['username'] = username

    context = {
        'search_page_props': json.dumps(props),
        'is_search_page': True,
    }
    context.update(
        DiscoveryMetadataService.build_noindex_page_metadata(
            request,
            reverse('search'),
        )
    )
    return render(request, 'board/search/search.html', context)
