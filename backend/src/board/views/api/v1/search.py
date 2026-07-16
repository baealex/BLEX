import time

from django.db.models import Case, Exists, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.http import Http404

from board.models import Post, PostContent, Profile, Tag, User
from board.modules.paginator import Paginator
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.modules.time import convert_to_localtime
from board.services.public_post_service import PublicPostService


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
    tag_value_match = Q()
    content_value_match = Q()

    for keyword in keywords:
        title_match |= Q(title__icontains=keyword)
        description_match |= Q(meta_description__icontains=keyword)
        tag_value_match |= Q(value__icontains=keyword)
        content_value_match |= Q(content_html__icontains=keyword)

    matching_tag = Tag.objects.filter(
        posts=OuterRef('pk'),
    ).filter(tag_value_match)
    matching_content = PostContent.objects.filter(
        post_id=OuterRef('pk'),
    ).filter(content_value_match)

    posts = PublicPostService.filter_public_posts(
        Post.objects.alias(
            has_tag_match=Exists(matching_tag),
            has_content_match=Exists(matching_content),
        ).filter(
            title_match
            | description_match
            | Q(has_tag_match=True)
            | Q(has_content_match=True)
        )
    )

    if username:
        posts = posts.filter(author__username=username)

    posts = posts.annotate(
        author_username=Subquery(
            User.objects.filter(pk=OuterRef('author_id')).values('username')[:1]
        ),
        author_image=Subquery(
            Profile.objects.filter(user_id=OuterRef('author_id')).values('avatar')[:1]
        ),
        title_score=Case(
            When(title_match, then=Value(100)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        description_score=Case(
            When(description_match, then=Value(40)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        tag_score=Case(
            When(has_tag_match=True, then=Value(30)),
            default=Value(0),
            output_field=IntegerField(),
        ),
        content_score=Case(
            When(has_content_match=True, then=Value(10)),
            default=Value(0),
            output_field=IntegerField(),
        ),
    ).annotate(
        relevance=F('title_score') + F('description_score') + F('tag_score') + F('content_score'),
    ).only(
        'url',
        'title',
        'image',
        'meta_description',
        'read_time',
        'published_date',
    ).order_by('-relevance', '-published_date')

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
