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
    
    try:
        page = int(page)
    except ValueError:
        page = 1
    
    context = {
        'query': query,
        'username': username,
        'page': page,
        'is_loading': False,
        'results': [],
        'error_message': None,
        'total_size': 0,
        'elapsed_time': 0,
        'last_page': 1,
        'page_range': [],
        'search_history': []
    }
    
    # 검색 히스토리 가져오기
    if request.user.is_authenticated:
        # 사용자의 검색 기록 가져오기
        search_history = Search.objects.filter(
            user=request.user
        ).select_related('search_value').order_by('-created_date')[:5]
        
        context['search_history'] = [
            {'pk': item.pk, 'keyword': item.search_value.value} 
            for item in search_history
        ]
    
    # 검색어가 없으면 검색 페이지만 표시
    if not query:
        return render(request, 'board/search.html', context)
    
    # 검색 실행
    try:
        # API 함수 호출을 위한 요청 객체 설정
        api_request = request
        api_request.GET = request.GET.copy()
        api_request.GET['q'] = query
        api_request.GET['page'] = str(page)
        if username:
            api_request.GET['username'] = username
            
        # 검색 API 호출
        api_response = search(api_request)
        
        # API 응답 처리
        if api_response.status_code != 200:
            context['error_message'] = '검색 서버에 연결할 수 없습니다.'
        else:
            result_data = api_response.json()
            
            if result_data.get('status') == 'ERROR':
                context['error_message'] = result_data.get('errorMessage', '검색 중 오류가 발생했습니다.')
            else:
                # 검색 결과 처리
                data = result_data.get('data', {})
                context['results'] = data.get('results', [])
                context['total_size'] = data.get('total_size', 0)
                context['last_page'] = data.get('last_page', 1)
                context['elapsed_time'] = data.get('elapsed_time', 0)
                
                # 페이지네이션 범위 계산
                if context['last_page'] > 1:
                    start_page = max(1, page - 2)
                    end_page = min(context['last_page'], page + 2)
                    context['page_range'] = list(range(start_page, end_page + 1))
                else:
                    context['page_range'] = [1] if context['last_page'] == 1 else []
    
    except Exception as e:
        context['error_message'] = f"검색 중 오류가 발생했습니다: {str(e)}"
    
    return render(request, 'board/search.html', context)
