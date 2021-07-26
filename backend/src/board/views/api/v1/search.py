import datetime
import math
import time

from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import F, Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import Post, Search, SearchValue, History
from board.views import function as fn
from modules.analytics import create_history, get_network_addr
from modules.response import StatusDone, StatusError
from modules.subtask import sub_task_manager

SIMILAR_KEYWORDS = [
    ('android', '안드로이드'),
    ('debian', '데비안'),
    ('django', '장고'),
    ('flask', '플라스크'),
    ('javascript', '자바스크립트'),
    ('linux', '리눅스'),
    ('pythonic', '파이써닉'),
    ('python', '파이썬'),
    ('react', '리액트'),
    ('rust', '러스트'),
    ('typescript', '타입스크립트'),
    ('ubuntu', '우분투'),
    ('windows', '윈도우'),
]

def search(request):
    if request.method == 'GET':
        query = request.GET.get('q', '')[:10].lower()
        page = int(request.GET.get('page', 1))
        username = request.GET.get('username', '')

        if len(query) < 2:
            return StatusError('RJ', '2글자 이상의 검색어를 입력하세요.')

        results = []
        search_words = []

        if ',' in query:
            search_words = query.split(',')
        else:
            for keyword in SIMILAR_KEYWORDS:
                if query in keyword:
                    search_words = list(keyword)
                    break
            if not search_words:
                search_words = [query]

        posts = Post.objects.filter(
            hide=False,
            created_date__lte=timezone.now()
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        )
        if username:
            posts = posts.filter(author__username=username)

        start_time = time.time()
        for post in posts.iterator():
            max_score = 0

            for search_word in search_words:
                score = 0

                post_title_lower = post.title.lower()
                if search_word in post_title_lower:
                    score += 3
                    word_pos = post_title_lower.find(search_word)
                    if word_pos == 0 or post_title_lower[word_pos-1] == ' ':
                        score += 2
                
                if search_word in post.tag.split(','):
                    score += 2
                
                if search_word in post.text_md.lower():
                    score += 1
                
                if score > max_score:
                    max_score = score
            
            if max_score > 0:
                results.append((post, max_score))
        elapsed_time = round(time.time() - start_time, 3)

        total_size = len(results)
        results = sorted(results, key=lambda x: x[1], reverse=True)

        limit = 30
        last_page = math.ceil(total_size / limit)
        results = results[(page - 1) * limit:page * limit]

        if page > 1 and len(results) < 1:
            raise Http404
        
        results = list(map(lambda x: x[0], results))

        if total_size > 0:
            def save_search_query():
                user_addr = get_network_addr(request)
                user_agent = request.META['HTTP_USER_AGENT']
                history = create_history(user_addr, user_agent)

                search_value = None
                try:
                    search_value = SearchValue.objects.get(value=query)
                except:
                    search_value = SearchValue(value=query)
                    search_value.save()
                    search_value.refresh_from_db()

                recent = timezone.now() - datetime.timedelta(hours=1)
                has_search = Search.objects.filter(
                    searcher=history,
                    search_value=search_value,
                    created_date__gt=recent,
                ).exists()
                
                if not has_search:
                    if request.user.id:
                        Search(
                            user=request.user,
                            searcher=history,
                            search_value=search_value,
                        ).save()
                    else:
                        Search(
                            searcher=history,
                            search_value=search_value,
                        ).save()
            
            sub_task_manager.append(save_search_query)

        return StatusDone({
            'elapsed_time': elapsed_time,
            'total_size': total_size,
            'last_page': last_page,
            'results': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.description(),
                'read_time': post.read_time,
                'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
            }, results)),
        })

    raise Http404

def search_history(request, pk=None):
    if not pk:
        if request.method == 'GET':
            if request.user.id:
                searches = Search.objects.filter(
                    user=request.user.id
                ).annotate(
                    value=F('search_value__value')
                ).order_by('-created_date')[:10]

                return StatusDone({
                    'searches': list(map(lambda search: {
                        'pk': search.id,
                        'value': search.value
                    }, searches))
                })
            else:
                return StatusDone({
                    'searches': [],
                })
    
    if pk:
        if request.method == 'DELETE':
            search = get_object_or_404(Search, id=pk, user=request.user)
            search.user = None
            search.save()
            return StatusDone()
    
    raise Http404