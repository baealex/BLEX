from django.shortcuts import render
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

from board.models import Search, SearchValue
from board.views.api.v1.search import search

def search_view(request):
    """
    검색 페이지 뷰
    """
    # 쿼리 파라미터 가져오기
    query = request.GET.get('q', '')
    username = request.GET.get('u', '')
    page = request.GET.get('page', 1)
    
    context = {
        'query': query,
        'username': username,
        'page': page,
    }

    return render(request, 'board/search.html', context)
