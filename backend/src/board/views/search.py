import json

from django.shortcuts import render


def search_page(request):
    username = request.GET.get('username', '').strip()

    props = {}
    if username:
        props['username'] = username

    context = {
        'search_page_props': json.dumps(props),
        'is_search_page': True,
    }
    return render(request, 'board/search/search.html', context)
