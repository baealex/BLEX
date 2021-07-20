import math
import time

from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import F, Q
from django.http import Http404
from django.utils import timezone

from board.models import Post
from board.views import function as fn
from modules.response import StatusDone, StatusError

SIMILAR_KEYWORDS = [
    ('django', '장고'),
    ('flask', '플라스크'),
    ('javascript', '자바스크립트'),
    ('pythonic', '파이써닉'),
    ('python', '파이썬'),
    ('react', '리액트'),
    ('rust', '러스트'),
    ('typescript', '타입스크립트'),
]

def search(request):
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
            if search_word in post.title.lower():
                score += 100
            if search_word in post.tag:
                score += 50
            if search_word in post.text_md.lower():
                score += 10    
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