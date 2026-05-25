from django.conf import settings
from django.db.models import Count, Q
from ninja import Body, File, NinjaAPI, Query, Status, UploadedFile
from ninja.errors import HttpError, ValidationError
from ninja.security import HttpBearer

from board.models import Series, Tag
from board.modules.developer_serializers import (
    DeveloperPostSerializer,
    DeveloperSeriesSerializer,
    DeveloperTagSerializer,
)
from board.services.developer_token_service import (
    DeveloperAuthError,
    DeveloperTokenService,
)
from board.services.image_upload_service import ImageUploadError, ImageUploadService
from board.services.post_service import PostService, PostValidationError
from board.views.api.developer.v1.post import DeveloperPostAPI
from board.views.api.developer.v1.publishing import DeveloperPublishingAPI
from board.views.api.developer.v1.schemas import (
    DeletePostEnvelope,
    DeveloperErrorEnvelope,
    DeveloperMeEnvelope,
    ImageUploadEnvelope,
    PostDetailEnvelope,
    PostListEnvelope,
    PostMutationPayload,
    PostPublishPayload,
    PostUpdatePayload,
    SeriesListEnvelope,
    TagListEnvelope,
)


class DeveloperApiException(Exception):
    def __init__(self, error: DeveloperAuthError):
        self.code = error.code
        self.message = error.message
        self.status_code = error.status_code
        super().__init__(error.message)


class DeveloperBearerAuth(HttpBearer):
    def __call__(self, request):
        try:
            return DeveloperTokenService.authenticate_request(request)
        except DeveloperAuthError as error:
            raise DeveloperApiException(error)

    def authenticate(self, request, token):
        return None


api = NinjaAPI(
    title='BLEX Developer API',
    version='1.0.0',
    description='Personal token API for managing BLEX posts from external tools.',
    auth=DeveloperBearerAuth(),
    urls_namespace='developer_api_v1',
)


ERROR_RESPONSES = {
    400: DeveloperErrorEnvelope,
    401: DeveloperErrorEnvelope,
    403: DeveloperErrorEnvelope,
    404: DeveloperErrorEnvelope,
    409: DeveloperErrorEnvelope,
    422: DeveloperErrorEnvelope,
}

def success(data, status=200):
    return Status(status, {'data': data})


def error_response(code, message, status=400, fields=None):
    error = {
        'code': code,
        'message': message,
    }
    if fields:
        error['fields'] = fields
    return Status(status, {'error': error})


def auth_error_response(error: DeveloperAuthError):
    return error_response(error.code, error.message, error.status_code)


def require_scope(token, scope):
    try:
        DeveloperTokenService.require_scope(token, scope)
    except DeveloperAuthError as error:
        raise DeveloperApiException(error)


def payload_data(payload):
    if payload is None:
        return {}
    return payload.model_dump(exclude_unset=True)


def content_is_provided(data):
    return any(
        key in data
        for key in ('markdown', 'content_html', 'content', 'text_html', 'text_md')
    )


def post_validation_error(error: PostValidationError):
    return error_response(
        f'post.{error.code.value.lower()}',
        error.message,
        400,
    )


def developer_me_data(token):
    return {
        'user': {
            'id': token.user.id,
            'username': token.user.username,
            'name': token.user.first_name,
            'email': token.user.email,
            'is_editor': hasattr(token.user, 'profile') and token.user.profile.is_editor(),
        },
        'token': {
            'id': token.id,
            'name': token.name,
            'token_prefix': token.token_prefix,
            'scopes': token.scopes,
        },
    }


@api.exception_handler(DeveloperApiException)
def handle_developer_api_exception(request, exc):
    return api.create_response(
        request,
        {
            'error': {
                'code': exc.code,
                'message': exc.message,
            },
        },
        status=exc.status_code,
    )


@api.exception_handler(ValidationError)
def handle_validation_error(request, exc):
    return api.create_response(
        request,
        {
            'error': {
                'code': 'request.invalid_payload',
                'message': '요청 값을 확인할 수 없습니다.',
                'fields': {'errors': exc.errors},
            },
        },
        status=422,
    )


@api.exception_handler(HttpError)
def handle_http_error(request, exc):
    code = 'request.invalid_json' if exc.status_code == 400 else 'request.error'
    message = 'JSON 본문을 해석할 수 없습니다.' if code == 'request.invalid_json' else exc.message
    return api.create_response(
        request,
        {
            'error': {
                'code': code,
                'message': message,
            },
        },
        status=exc.status_code,
    )


@api.get(
    '/me',
    response={200: DeveloperMeEnvelope, **ERROR_RESPONSES},
    operation_id='getMe',
    summary='토큰과 계정 확인',
    tags=['Developer API'],
)
def get_me(request):
    response = success(developer_me_data(request.auth))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/posts',
    response={200: PostListEnvelope, **ERROR_RESPONSES},
    operation_id='listPosts',
    summary='글 목록 조회',
    tags=['Posts'],
)
def list_posts(request, status: str = '', page: int = 1, limit: int = 20):
    require_scope(request.auth, 'posts:read')

    try:
        queryset = DeveloperPostAPI.post_queryset(request.auth.user)
        queryset = DeveloperPostAPI.status_filter(queryset, status).order_by('-updated_date')
    except DeveloperAuthError as error:
        return auth_error_response(error)

    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    offset = (page - 1) * limit
    total = queryset.count()
    posts = queryset[offset:offset + limit]

    response = success({
        'posts': [
            DeveloperPostSerializer.summary(post)
            for post in posts
        ],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
        },
    })
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.post(
    '/posts',
    response={201: PostDetailEnvelope, **ERROR_RESPONSES},
    operation_id='createPost',
    summary='글 생성',
    tags=['Posts'],
)
def create_post(request, payload: PostMutationPayload):
    require_scope(request.auth, 'posts:write')
    data = payload_data(payload)
    status = data.get('status', 'draft')

    try:
        content_type = DeveloperPostAPI.content_type(data)
        series_url = DeveloperPostAPI.series_url(data, request.auth.user)
        content = DeveloperPostAPI.content_value(data)

        if status == 'draft':
            post = PostService.create_draft(
                user=request.auth.user,
                title=data.get('title', ''),
                text_html=content,
                subtitle=data.get('subtitle', ''),
                description=data.get('description', ''),
                series_url=series_url,
                tag=DeveloperPostAPI.tags_value(data),
                custom_url=data.get('slug', data.get('url', '')),
                content_type=content_type,
            )
        elif status in ('published', 'scheduled'):
            if status == 'scheduled' and not data.get('published_at'):
                return error_response(
                    'post.missing_published_at',
                    'scheduled status에는 published_at이 필요합니다.',
                    400,
                )

            post, _, _ = PostService.create_post(
                user=request.auth.user,
                title=data.get('title', ''),
                text_html=content,
                subtitle=data.get('subtitle', ''),
                description=data.get('description', ''),
                reserved_date_str=data.get('published_at', ''),
                series_url=series_url,
                custom_url=data.get('slug', data.get('url', '')),
                tag=DeveloperPostAPI.tags_value(data),
                is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), False),
                is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), False),
                content_type=content_type,
            )
        else:
            return error_response(
                'post.invalid_status',
                'status는 draft, published, scheduled 중 하나여야 합니다.',
                400,
            )
    except DeveloperAuthError as error:
        return auth_error_response(error)
    except PostValidationError as error:
        return post_validation_error(error)

    post = DeveloperPostAPI.get_owned_post(request.auth.user, post.id)
    response = success(DeveloperPostSerializer.detail(post), status=201)
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/posts/search',
    response={200: PostListEnvelope, **ERROR_RESPONSES},
    operation_id='searchPosts',
    summary='내 글 검색',
    tags=['Posts'],
)
def search_posts(
    request,
    q: str = '',
    tag: list[str] | None = Query(None),
    status: str = '',
    series_id: str | None = None,
    page: int = 1,
    limit: int = 20,
):
    require_scope(request.auth, 'posts:read')
    queryset = DeveloperPostAPI.post_queryset(request.auth.user)
    queryset = DeveloperPublishingAPI.filter_by_search_query(queryset, q)

    try:
        queryset = DeveloperPostAPI.status_filter(queryset, status)
        queryset = DeveloperPublishingAPI.filter_by_series_id(queryset, series_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    tags = DeveloperPublishingAPI.tags_param(request)
    if tags:
        queryset = queryset.filter(tags__value__in=tags)

    queryset = queryset.distinct().order_by('-updated_date')
    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    offset = (page - 1) * limit
    total = queryset.count()
    posts = queryset[offset:offset + limit]

    response = success({
        'posts': [
            DeveloperPostSerializer.summary(post)
            for post in posts
        ],
        'pagination': {
            'page': page,
            'limit': limit,
            'total': total,
        },
    })
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/posts/{post_id}',
    response={200: PostDetailEnvelope, **ERROR_RESPONSES},
    operation_id='getPost',
    summary='글 상세 조회',
    tags=['Posts'],
)
def get_post(request, post_id: int):
    require_scope(request.auth, 'posts:read')

    try:
        post = DeveloperPostAPI.get_owned_post(request.auth.user, post_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    response = success(DeveloperPostSerializer.detail(post))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.patch(
    '/posts/{post_id}',
    response={200: PostDetailEnvelope, **ERROR_RESPONSES},
    operation_id='updatePost',
    summary='글 수정',
    tags=['Posts'],
)
def update_post(request, post_id: int, payload: PostUpdatePayload):
    require_scope(request.auth, 'posts:write')
    data = payload_data(payload)

    try:
        post = DeveloperPostAPI.get_owned_post(request.auth.user, post_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    expected_updated_at = data.get('expected_updated_at')
    actual_updated_at = post.updated_date.isoformat()
    if expected_updated_at and expected_updated_at != actual_updated_at:
        response = error_response(
            'post.version_conflict',
            '글이 이미 다른 요청으로 수정되었습니다.',
            409,
            fields={
                'expected_updated_at': expected_updated_at,
                'actual_updated_at': actual_updated_at,
                'post_id': post.id,
            },
        )
        DeveloperTokenService.record_request(request, request.auth, response.status_code)
        return response

    content = DeveloperPostAPI.content_value(data) if content_is_provided(data) else None
    content_type = None
    try:
        if content is not None:
            content_type = DeveloperPostAPI.content_type(data)

        if post.is_draft():
            PostService.update_draft(
                post=post,
                title=data.get('title'),
                text_html=content,
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=DeveloperPostAPI.series_url(data, request.auth.user),
                tag=DeveloperPostAPI.tags_value(data) if 'tags' in data or 'tag' in data else None,
                custom_url=data.get('slug', data.get('url')) if 'slug' in data or 'url' in data else None,
                content_type=content_type,
            )
        else:
            PostService.update_post(
                post=post,
                title=data.get('title'),
                text_html=content,
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=DeveloperPostAPI.series_url(data, request.auth.user),
                custom_url=data.get('slug', data.get('url')) if 'slug' in data or 'url' in data else None,
                tag=DeveloperPostAPI.tags_value(data) if 'tags' in data or 'tag' in data else None,
                is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), post.config.hide)
                if 'is_hidden' in data or 'is_hide' in data else None,
                is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), post.config.advertise)
                if 'is_advertise' in data else None,
                content_type=content_type,
            )
    except DeveloperAuthError as error:
        return auth_error_response(error)
    except PostValidationError as error:
        return post_validation_error(error)

    if post.is_draft():
        DeveloperPostAPI.update_config(post, data)

    post = DeveloperPostAPI.get_owned_post(request.auth.user, post.id)
    response = success(DeveloperPostSerializer.detail(post))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.delete(
    '/posts/{post_id}',
    response={200: DeletePostEnvelope, **ERROR_RESPONSES},
    operation_id='deletePost',
    summary='글 삭제',
    tags=['Posts'],
)
def delete_post(request, post_id: int, dry_run: bool = False):
    require_scope(request.auth, 'posts:write')

    try:
        post = DeveloperPostAPI.get_owned_post(request.auth.user, post_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    if dry_run:
        response = success({
            'can_delete': True,
            'post': DeveloperPostSerializer.summary(post),
        })
        DeveloperTokenService.record_request(request, request.auth, response.status_code)
        return response

    PostService.delete_post(post)
    response = success({
        'deleted': True,
        'id': post.id,
    })
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.post(
    '/posts/{post_id}/publish',
    response={200: PostDetailEnvelope, **ERROR_RESPONSES},
    operation_id='publishPost',
    summary='임시 글 발행',
    tags=['Posts'],
)
def publish_post(request, post_id: int, payload: PostPublishPayload | None = Body(None)):
    require_scope(request.auth, 'posts:write')
    data = payload_data(payload)

    try:
        post = DeveloperPostAPI.get_owned_post(request.auth.user, post_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    if not post.is_draft():
        response = error_response(
            'post.not_draft',
            '이미 발행되었거나 예약된 글입니다.',
            409,
        )
        DeveloperTokenService.record_request(request, request.auth, response.status_code)
        return response

    content = DeveloperPostAPI.content_value(data) if content_is_provided(data) else None
    content_type = None
    try:
        if content is not None:
            content_type = DeveloperPostAPI.content_type(data)

        PostService.publish_draft(
            post=post,
            title=data.get('title'),
            text_html=content,
            subtitle=data.get('subtitle'),
            description=data.get('description'),
            series_url=DeveloperPostAPI.series_url(data, request.auth.user),
            custom_url=data.get('slug', data.get('url')) if 'slug' in data or 'url' in data else None,
            tag=DeveloperPostAPI.tags_value(data) if 'tags' in data or 'tag' in data else None,
            is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), False),
            is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), False),
            reserved_date_str=data.get('published_at', ''),
            content_type=content_type,
        )
    except DeveloperAuthError as error:
        return auth_error_response(error)
    except PostValidationError as error:
        return post_validation_error(error)

    post = DeveloperPostAPI.get_owned_post(request.auth.user, post.id)
    response = success(DeveloperPostSerializer.detail(post))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/tags',
    response={200: TagListEnvelope, **ERROR_RESPONSES},
    operation_id='listTags',
    summary='내 글 태그 목록',
    tags=['Publishing Metadata'],
)
def list_tags(request):
    require_scope(request.auth, 'posts:read')
    tags = Tag.objects.filter(
        posts__author=request.auth.user,
    ).annotate(
        post_count=Count(
            'posts',
            filter=Q(posts__author=request.auth.user),
            distinct=True,
        ),
    ).order_by(
        'value',
    ).distinct()

    response = success({
        'tags': [
            DeveloperTagSerializer.serialize(tag)
            for tag in tags
        ],
    })
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/series',
    response={200: SeriesListEnvelope, **ERROR_RESPONSES},
    operation_id='listSeries',
    summary='내 시리즈 목록',
    tags=['Publishing Metadata'],
)
def list_series(request):
    require_scope(request.auth, 'posts:read')
    series = Series.objects.filter(
        owner=request.auth.user,
    ).annotate(
        post_count=Count('posts', distinct=True),
    ).order_by(
        'order',
        'name',
        'id',
    )

    response = success({
        'series': [
            DeveloperSeriesSerializer.serialize(item)
            for item in series
        ],
    })
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.post(
    '/images',
    response={201: ImageUploadEnvelope, **ERROR_RESPONSES},
    operation_id='uploadImage',
    summary='본문 이미지 업로드',
    tags=['Media'],
)
def upload_image(request, image: UploadedFile = File(...)):
    require_scope(request.auth, 'posts:write')

    if image.size > settings.DEVELOPER_API_MAX_UPLOAD_BYTES:
        response = error_response(
            'image.too_large',
            f'이미지 파일은 {settings.DEVELOPER_API_MAX_UPLOAD_MB}MiB 이하만 업로드할 수 있습니다.',
            400,
        )
        DeveloperTokenService.record_request(request, request.auth, response.status_code)
        return response

    try:
        url = ImageUploadService.upload_content_image(
            image,
            user=request.auth.user,
        )
    except ImageUploadError as error:
        status = 422 if error.code == 'image.upload_failed' else 400
        response = error_response(error.code, error.message, status)
        DeveloperTokenService.record_request(request, request.auth, response.status_code)
        return response

    response = success({
        'url': url,
    }, status=201)
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response
