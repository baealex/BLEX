from django.conf import settings
from django.db.models import Count, Q, Window
from django.utils.translation import gettext, gettext_lazy as _
from ninja import Body, File, NinjaAPI, Query, Status, UploadedFile
from ninja.errors import HttpError, ValidationError
from ninja.security import HttpBearer

from board.decorators import editor_required
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
    title=_('BLEX Developer API'),
    version='1.0.0',
    description=_(
        'Personal token API for managing BLEX posts from external tools.'
    ),
    auth=DeveloperBearerAuth(),
    urls_namespace='developer_api_v1',
    docs_decorator=editor_required,
)

DEVELOPER_API_TAG = _('Developer API')
POSTS_TAG = _('Posts')
PUBLISHING_METADATA_TAG = _('Publishing metadata')
MEDIA_TAG = _('Media')


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


def paginated_posts(queryset, page, limit):
    """Return a page and its total without a separate count on populated pages."""
    offset = (page - 1) * limit
    posts = list(
        queryset.annotate(developer_total=Window(Count('pk')))[offset:offset + limit]
    )
    total = posts[0].developer_total if posts else queryset.count()
    return posts, total


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
                'message': gettext('The request payload could not be validated.'),
                'fields': {'errors': exc.errors},
            },
        },
        status=422,
    )


@api.exception_handler(HttpError)
def handle_http_error(request, exc):
    code = 'request.invalid_json' if exc.status_code == 400 else 'request.error'
    message = (
        gettext('The JSON request body could not be parsed.')
        if code == 'request.invalid_json'
        else exc.message
    )
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
    summary=_('Get token and account details'),
    tags=[DEVELOPER_API_TAG],
)
def get_me(request):
    response = success(developer_me_data(request.auth))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.get(
    '/posts',
    response={200: PostListEnvelope, **ERROR_RESPONSES},
    operation_id='listPosts',
    summary=_('List posts'),
    tags=[POSTS_TAG],
)
def list_posts(request, status: str = '', page: int = 1, limit: int = 20):
    require_scope(request.auth, 'posts:read')

    try:
        queryset = DeveloperPostAPI.post_summary_queryset(request.auth.user)
        queryset = DeveloperPostAPI.status_filter(queryset, status).order_by('-updated_date')
    except DeveloperAuthError as error:
        return auth_error_response(error)

    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    posts, total = paginated_posts(queryset, page, limit)

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
    summary=_('Create a post'),
    tags=[POSTS_TAG],
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
                cover_layout=data.get('cover_layout'),
                cover_image_position=data.get('cover_image_position'),
                cover_image_ratio=data.get('cover_image_ratio'),
                is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), False),
                is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), False),
            )
        elif status in ('published', 'scheduled'):
            if status == 'scheduled' and not data.get('published_at'):
                return error_response(
                    'post.missing_published_at',
                    gettext(
                        'published_at is required when status is scheduled.'
                    ),
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
                cover_layout=data.get('cover_layout'),
                cover_image_position=data.get('cover_image_position'),
                cover_image_ratio=data.get('cover_image_ratio'),
            )
        else:
            return error_response(
                'post.invalid_status',
                gettext(
                    'status must be one of draft, published, or scheduled.'
                ),
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
    summary=_('Search my posts'),
    tags=[POSTS_TAG],
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
    queryset = DeveloperPostAPI.post_summary_queryset(request.auth.user)
    queryset = DeveloperPublishingAPI.filter_by_search_query(queryset, q)

    try:
        queryset = DeveloperPostAPI.status_filter(queryset, status)
        queryset = DeveloperPublishingAPI.filter_by_series_id(queryset, series_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    tags = DeveloperPublishingAPI.tags_param(request)
    queryset = DeveloperPublishingAPI.filter_by_tags(queryset, tags)

    queryset = queryset.order_by('-updated_date')
    page = max(page, 1)
    limit = min(max(limit, 1), 100)
    posts, total = paginated_posts(queryset, page, limit)

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
    summary=_('Get post details'),
    tags=[POSTS_TAG],
)
def get_post(request, post_id: int):
    require_scope(request.auth, 'posts:read')

    try:
        post = DeveloperPostAPI.get_owned_post_detail(request.auth.user, post_id)
    except DeveloperAuthError as error:
        return auth_error_response(error)

    response = success(DeveloperPostSerializer.detail(post))
    DeveloperTokenService.record_request(request, request.auth, response.status_code)
    return response


@api.patch(
    '/posts/{post_id}',
    response={200: PostDetailEnvelope, **ERROR_RESPONSES},
    operation_id='updatePost',
    summary=_('Update a post'),
    tags=[POSTS_TAG],
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
            gettext('The post was already updated by another request.'),
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
                cover_layout=data.get('cover_layout'),
                cover_image_position=data.get('cover_image_position'),
                cover_image_ratio=data.get('cover_image_ratio'),
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
                cover_layout=data.get('cover_layout'),
                cover_image_position=data.get('cover_image_position'),
                cover_image_ratio=data.get('cover_image_ratio'),
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
    summary=_('Delete a post'),
    tags=[POSTS_TAG],
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
    summary=_('Publish a draft'),
    tags=[POSTS_TAG],
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
            gettext('This post has already been published or scheduled.'),
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
            is_hide=DeveloperPostAPI.parse_bool(
                data.get('is_hidden', data.get('is_hide')),
                post.config.hide,
            ),
            is_advertise=DeveloperPostAPI.parse_bool(
                data.get('is_advertise'),
                post.config.advertise,
            ),
            reserved_date_str=data.get('published_at', ''),
            content_type=content_type,
            cover_layout=data.get('cover_layout'),
            cover_image_position=data.get('cover_image_position'),
            cover_image_ratio=data.get('cover_image_ratio'),
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
    summary=_('List my post tags'),
    tags=[PUBLISHING_METADATA_TAG],
)
def list_tags(request):
    require_scope(request.auth, 'posts:read')
    tags = Tag.objects.filter(
        posts__author=request.auth.user,
        posts__deleted_date__isnull=True,
    ).annotate(
        post_count=Count(
            'posts',
            filter=Q(
                posts__author=request.auth.user,
                posts__deleted_date__isnull=True,
            ),
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
    summary=_('List my series'),
    tags=[PUBLISHING_METADATA_TAG],
)
def list_series(request):
    require_scope(request.auth, 'posts:read')
    series = Series.objects.filter(
        owner=request.auth.user,
    ).annotate(
        post_count=Count(
            'posts',
            filter=Q(posts__deleted_date__isnull=True),
            distinct=True,
        ),
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
    summary=_('Upload a content image'),
    tags=[MEDIA_TAG],
)
def upload_image(request, image: UploadedFile = File(...)):
    require_scope(request.auth, 'posts:write')

    if image.size > settings.DEVELOPER_API_MAX_UPLOAD_BYTES:
        response = error_response(
            'image.too_large',
            gettext('Image files must be %(max_size)s MiB or smaller.') % {
                'max_size': settings.DEVELOPER_API_MAX_UPLOAD_MB,
            },
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
