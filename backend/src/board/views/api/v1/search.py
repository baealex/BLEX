import time

from django.db.models import Case, F, IntegerField, Max, Q, Value, When
from django.http import Http404
from django.utils import timezone

from board.models import Post
from board.modules.paginator import Paginator
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.modules.time import convert_to_localtime


def search(request):
    if request.method != 'GET':
        raise Http404

    query = request.GET.get('q', '')[:100].strip()
    username = request.GET.get('username', '').strip()

    if len(query) < 1:
        return StatusError(ErrorCode.VALIDATE, '검색어를 입력하세요.')

    keywords = [keyword for keyword in query.split() if keyword]
    if len(keywords) < 1:
        return StatusError(ErrorCode.VALIDATE, '검색어를 입력하세요.')

    page = request.GET.get('page', 1)
    try:
        page = max(1, int(page))
    except (ValueError, TypeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 페이지 번호입니다.')

    start_time = time.perf_counter()

    title_match = Q()
    description_match = Q()
    tag_match = Q()
    content_match = Q()

    for keyword in keywords:
        title_match |= Q(title__icontains=keyword)
        description_match |= Q(meta_description__icontains=keyword)
        tag_match |= Q(tags__value__icontains=keyword)
        content_match |= Q(content__text_md__icontains=keyword)

    search_filter = title_match | description_match | tag_match | content_match

    posts = Post.objects.filter(
        search_filter,
        config__hide=False,
        published_date__isnull=False,
        published_date__lte=timezone.now(),
    )

    if username:
        posts = posts.filter(author__username=username)

    posts = posts.annotate(
        author_username=F('author__username'),
        author_image=F('author__profile__avatar'),
        title_score=Max(
            Case(
                When(title_match, then=Value(100)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ),
        description_score=Max(
            Case(
                When(description_match, then=Value(40)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ),
        tag_score=Max(
            Case(
                When(tag_match, then=Value(30)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ),
        content_score=Max(
            Case(
                When(content_match, then=Value(10)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ),
    ).annotate(
        relevance=F('title_score') + F('description_score') + F('tag_score') + F('content_score'),
    ).distinct().order_by('-relevance', '-published_date')

    try:
        paginated = Paginator(
            objects=posts,
            offset=30,
            page=page,
        )
    except Http404:
        return StatusError(ErrorCode.VALIDATE, '잘못된 페이지 번호입니다.')

    elapsed_time = round(time.perf_counter() - start_time, 3)
    return StatusDone({
        'elapsed_time': elapsed_time,
        'total_size': paginated.paginator.count,
        'last_page': paginated.paginator.num_pages,
        'query': query,
        'results': list(map(lambda post: {
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'description': post.meta_description,
            'read_time': post.read_time,
            'created_date': convert_to_localtime(post.published_date).strftime('%Y년 %m월 %d일'),
            'author_image': post.author_image,
            'author': post.author_username,
            'positions': list(filter(lambda item: item, [
                '제목' if post.title_score > 0 else '',
                '설명' if post.description_score > 0 else '',
                '태그' if post.tag_score > 0 else '',
                '내용' if post.content_score > 0 else '',
            ])),
        }, paginated)),
    })
