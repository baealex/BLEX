import time

from django.db.models import Case, Exists, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.http import Http404, JsonResponse
from django.utils.translation import gettext as _

from board.models import Post, PostContent, Profile, Tag, User
from board.modules.paginator import Paginator
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.modules.time import convert_to_localtime
from board.services.public_post_service import PublicPostService


QUERY_REQUIRED_MESSAGE_KEY = 'search.validation.query_required'
INVALID_PAGE_MESSAGE_KEY = 'search.validation.invalid_page'


class SearchResponseBuilder:
    MATCH_FIELDS = (
        ('title_score', 'title', '제목'),
        ('description_score', 'description', '설명'),
        ('tag_score', 'tag', '태그'),
        ('content_score', 'content', '내용'),
    )

    @staticmethod
    def validation_error(message: str, message_key: str) -> JsonResponse:
        return StatusError(
            ErrorCode.VALIDATE,
            message,
            message_key=message_key,
            message_params={},
        )

    @classmethod
    def serialize_result(cls, post: Post) -> dict[str, object]:
        published_date = convert_to_localtime(post.published_date)
        matched_fields = [
            field
            for score_attribute, field, _legacy_label in cls.MATCH_FIELDS
            if getattr(post, score_attribute) > 0
        ]
        legacy_positions = [
            legacy_label
            for score_attribute, _field, legacy_label in cls.MATCH_FIELDS
            if getattr(post, score_attribute) > 0
        ]

        return {
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'description': post.meta_description,
            'read_time': post.read_time,
            'created_date': published_date.strftime('%Y년 %m월 %d일'),
            'published_date': published_date.date().isoformat(),
            'author_image': post.author_image,
            'author': post.author_username,
            'positions': legacy_positions,
            'matched_fields': matched_fields,
        }


def search(request):
    if request.method != 'GET':
        raise Http404

    query = request.GET.get('q', '')[:100].strip()
    username = request.GET.get('username', '').strip()

    if len(query) < 1:
        return SearchResponseBuilder.validation_error(
            _('Enter a search term.'),
            QUERY_REQUIRED_MESSAGE_KEY,
        )

    keywords = [keyword for keyword in query.split() if keyword]
    if len(keywords) < 1:
        return SearchResponseBuilder.validation_error(
            _('Enter a search term.'),
            QUERY_REQUIRED_MESSAGE_KEY,
        )

    page = request.GET.get('page', 1)
    try:
        page = max(1, int(page))
    except (ValueError, TypeError):
        return SearchResponseBuilder.validation_error(
            _('Invalid page number.'),
            INVALID_PAGE_MESSAGE_KEY,
        )

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
        return SearchResponseBuilder.validation_error(
            _('Invalid page number.'),
            INVALID_PAGE_MESSAGE_KEY,
        )

    elapsed_time = round(time.perf_counter() - start_time, 3)
    return StatusDone({
        'elapsed_time': elapsed_time,
        'total_size': paginated.paginator.count,
        'last_page': paginated.paginator.num_pages,
        'query': query,
        'results': list(map(SearchResponseBuilder.serialize_result, paginated)),
    })
