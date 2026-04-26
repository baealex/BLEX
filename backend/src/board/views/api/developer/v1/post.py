import json

from django.http import Http404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from board.models import Post, Series
from board.modules.developer_response import DeveloperResponse
from board.modules.developer_serializers import DeveloperPostSerializer
from board.services.developer_token_service import (
    DeveloperAuthError,
    DeveloperTokenService,
)
from board.services.post_service import PostService, PostValidationError


class DeveloperPostAPI:
    @staticmethod
    def authenticate(request, scope):
        token = DeveloperTokenService.authenticate_request(request)
        DeveloperTokenService.require_scope(token, scope)
        return token

    @staticmethod
    def auth_error(error):
        return DeveloperResponse.error(
            error.code,
            error.message,
            error.status_code,
        )

    @staticmethod
    def json_body(request):
        try:
            return json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            raise DeveloperAuthError(
                'request.invalid_json',
                'JSON 본문을 해석할 수 없습니다.',
                400,
            )

    @staticmethod
    def parse_bool(value, default=False):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('1', 'true', 'yes', 'on')
        return bool(value)

    @staticmethod
    def tags_value(data):
        tags = data.get('tags', data.get('tag', ''))
        if isinstance(tags, list):
            return ','.join(str(tag).strip() for tag in tags if str(tag).strip())
        return tags or ''

    @staticmethod
    def content_value(data):
        return data.get('content', data.get('text_html', data.get('text_md', '')))

    @staticmethod
    def content_type(data, default='html'):
        content_type = data.get('content_type', default)
        if content_type not in ('html', 'markdown'):
            raise DeveloperAuthError(
                'post.invalid_content_type',
                'content_type은 html 또는 markdown이어야 합니다.',
                400,
            )
        return content_type

    @staticmethod
    def series_url(data, user):
        if data.get('series_url') is not None:
            return data.get('series_url')

        series_id = data.get('series_id')
        if series_id in (None, ''):
            return None

        try:
            series = Series.objects.get(id=series_id, owner=user)
        except (Series.DoesNotExist, ValueError, TypeError):
            raise DeveloperAuthError(
                'post.series_not_found',
                'series_id에 해당하는 시리즈를 찾을 수 없습니다.',
                404,
            )
        return series.url

    @staticmethod
    def post_queryset(user):
        return Post.objects.select_related(
            'author',
            'author__profile',
            'config',
            'content',
            'series',
        ).prefetch_related(
            'tags',
        ).filter(
            author=user,
        )

    @staticmethod
    def get_owned_post(user, post_id):
        try:
            return DeveloperPostAPI.post_queryset(user).get(id=post_id)
        except Post.DoesNotExist:
            raise DeveloperAuthError(
                'post.not_found',
                '글을 찾을 수 없습니다.',
                404,
            )

    @staticmethod
    def status_filter(queryset, status):
        now = timezone.now()

        if not status:
            return queryset
        if status == 'draft':
            return queryset.filter(published_date__isnull=True)
        if status == 'published':
            return queryset.filter(
                published_date__isnull=False,
                published_date__lte=now,
                config__hide=False,
            )
        if status == 'scheduled':
            return queryset.filter(published_date__gt=now)
        if status == 'hidden':
            return queryset.filter(
                published_date__isnull=False,
                published_date__lte=now,
                config__hide=True,
            )

        raise DeveloperAuthError(
            'post.invalid_status',
            '지원하지 않는 status입니다.',
            400,
        )

    @staticmethod
    def pagination(request):
        try:
            page = int(request.GET.get('page', '1'))
            limit = int(request.GET.get('limit', '20'))
        except ValueError:
            raise DeveloperAuthError(
                'request.invalid_pagination',
                'page와 limit은 숫자여야 합니다.',
                400,
            )

        page = max(page, 1)
        limit = min(max(limit, 1), 100)
        offset = (page - 1) * limit
        return page, limit, offset

    @staticmethod
    def list_posts(request, token):
        queryset = DeveloperPostAPI.post_queryset(token.user)
        queryset = DeveloperPostAPI.status_filter(
            queryset,
            request.GET.get('status', ''),
        ).order_by('-updated_date')
        page, limit, offset = DeveloperPostAPI.pagination(request)

        total = queryset.count()
        posts = queryset[offset:offset + limit]

        response = DeveloperResponse.success({
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
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def create_post(request, token):
        data = DeveloperPostAPI.json_body(request)
        status = data.get('status', 'draft')
        content_type = DeveloperPostAPI.content_type(data)
        series_url = DeveloperPostAPI.series_url(data, token.user)
        content = DeveloperPostAPI.content_value(data)

        try:
            if status == 'draft':
                post = PostService.create_draft(
                    user=token.user,
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
                    return DeveloperResponse.error(
                        'post.missing_published_at',
                        'scheduled status에는 published_at이 필요합니다.',
                        400,
                    )

                post, _, _ = PostService.create_post(
                    user=token.user,
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
                return DeveloperResponse.error(
                    'post.invalid_status',
                    'status는 draft, published, scheduled 중 하나여야 합니다.',
                    400,
                )
        except PostValidationError as error:
            return DeveloperResponse.error(
                f'post.{error.code.value.lower()}',
                error.message,
                422,
            )

        post = DeveloperPostAPI.get_owned_post(token.user, post.id)
        response = DeveloperResponse.success(
            DeveloperPostSerializer.detail(post),
            status=201,
        )
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def validate_expected_updated_at(post, data):
        expected_updated_at = data.get('expected_updated_at')
        if not expected_updated_at:
            return None

        actual_updated_at = post.updated_date.isoformat()
        if expected_updated_at != actual_updated_at:
            return DeveloperResponse.error(
                'post.version_conflict',
                '글이 이미 다른 요청으로 수정되었습니다.',
                409,
                fields={
                    'expected_updated_at': expected_updated_at,
                    'actual_updated_at': actual_updated_at,
                },
            )
        return None

    @staticmethod
    def update_config(post, data):
        if 'is_hidden' not in data and 'is_hide' not in data and 'is_advertise' not in data:
            return

        config = post.config
        if 'is_hidden' in data or 'is_hide' in data:
            config.hide = DeveloperPostAPI.parse_bool(
                data.get('is_hidden', data.get('is_hide')),
                config.hide,
            )
        if 'is_advertise' in data:
            config.advertise = DeveloperPostAPI.parse_bool(
                data.get('is_advertise'),
                config.advertise,
            )
        config.save()

    @staticmethod
    def update_post(request, token, post):
        data = DeveloperPostAPI.json_body(request)
        conflict_response = DeveloperPostAPI.validate_expected_updated_at(post, data)
        if conflict_response:
            DeveloperTokenService.record_request(request, token, conflict_response.status_code)
            return conflict_response

        content = None
        if 'content' in data or 'text_html' in data or 'text_md' in data:
            content = DeveloperPostAPI.content_value(data)

        content_type = None
        if 'content_type' in data:
            content_type = DeveloperPostAPI.content_type(
                data,
                post.content.content_type if hasattr(post, 'content') else 'html',
            )

        try:
            if post.is_draft():
                PostService.update_draft(
                    post=post,
                    title=data.get('title'),
                    text_html=content,
                    subtitle=data.get('subtitle'),
                    description=data.get('description'),
                    series_url=DeveloperPostAPI.series_url(data, token.user),
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
                    series_url=DeveloperPostAPI.series_url(data, token.user),
                    custom_url=data.get('slug', data.get('url')) if 'slug' in data or 'url' in data else None,
                    tag=DeveloperPostAPI.tags_value(data) if 'tags' in data or 'tag' in data else None,
                    is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), post.config.hide)
                    if 'is_hidden' in data or 'is_hide' in data else None,
                    is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), post.config.advertise)
                    if 'is_advertise' in data else None,
                    content_type=content_type,
                )
        except PostValidationError as error:
            return DeveloperResponse.error(
                f'post.{error.code.value.lower()}',
                error.message,
                422,
            )

        if post.is_draft():
            DeveloperPostAPI.update_config(post, data)

        post = DeveloperPostAPI.get_owned_post(token.user, post.id)
        response = DeveloperResponse.success(DeveloperPostSerializer.detail(post))
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def delete_post(request, token, post):
        if request.GET.get('dry_run') == 'true':
            response = DeveloperResponse.success({
                'can_delete': True,
                'post': DeveloperPostSerializer.summary(post),
            })
            DeveloperTokenService.record_request(request, token, response.status_code)
            return response

        PostService.delete_post(post)
        response = DeveloperResponse.success({
            'deleted': True,
            'id': post.id,
        })
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def publish_post(request, token, post):
        if not post.is_draft():
            response = DeveloperResponse.error(
                'post.not_draft',
                '이미 발행되었거나 예약된 글입니다.',
                409,
            )
            DeveloperTokenService.record_request(request, token, response.status_code)
            return response

        data = DeveloperPostAPI.json_body(request)
        content = None
        if 'content' in data or 'text_html' in data or 'text_md' in data:
            content = DeveloperPostAPI.content_value(data)

        content_type = None
        if 'content_type' in data:
            content_type = DeveloperPostAPI.content_type(
                data,
                post.content.content_type if hasattr(post, 'content') else 'html',
            )

        try:
            PostService.publish_draft(
                post=post,
                title=data.get('title'),
                text_html=content,
                subtitle=data.get('subtitle'),
                description=data.get('description'),
                series_url=DeveloperPostAPI.series_url(data, token.user),
                custom_url=data.get('slug', data.get('url')) if 'slug' in data or 'url' in data else None,
                tag=DeveloperPostAPI.tags_value(data) if 'tags' in data or 'tag' in data else None,
                is_hide=DeveloperPostAPI.parse_bool(data.get('is_hidden', data.get('is_hide')), False),
                is_advertise=DeveloperPostAPI.parse_bool(data.get('is_advertise'), False),
                reserved_date_str=data.get('published_at', ''),
                content_type=content_type,
            )
        except PostValidationError as error:
            return DeveloperResponse.error(
                f'post.{error.code.value.lower()}',
                error.message,
                422,
            )

        post = DeveloperPostAPI.get_owned_post(token.user, post.id)
        response = DeveloperResponse.success(DeveloperPostSerializer.detail(post))
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response


@csrf_exempt
def posts(request):
    try:
        if request.method == 'GET':
            token = DeveloperPostAPI.authenticate(request, 'posts:read')
            return DeveloperPostAPI.list_posts(request, token)

        if request.method == 'POST':
            token = DeveloperPostAPI.authenticate(request, 'posts:write')
            return DeveloperPostAPI.create_post(request, token)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)

    raise Http404


@csrf_exempt
def post_detail(request, post_id):
    try:
        if request.method == 'GET':
            token = DeveloperPostAPI.authenticate(request, 'posts:read')
            post = DeveloperPostAPI.get_owned_post(token.user, post_id)
            response = DeveloperResponse.success(DeveloperPostSerializer.detail(post))
            DeveloperTokenService.record_request(request, token, response.status_code)
            return response

        if request.method == 'PATCH':
            token = DeveloperPostAPI.authenticate(request, 'posts:write')
            post = DeveloperPostAPI.get_owned_post(token.user, post_id)
            return DeveloperPostAPI.update_post(request, token, post)

        if request.method == 'DELETE':
            token = DeveloperPostAPI.authenticate(request, 'posts:write')
            post = DeveloperPostAPI.get_owned_post(token.user, post_id)
            return DeveloperPostAPI.delete_post(request, token, post)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)

    raise Http404


@csrf_exempt
def publish_post(request, post_id):
    if request.method != 'POST':
        raise Http404

    try:
        token = DeveloperPostAPI.authenticate(request, 'posts:write')
        post = DeveloperPostAPI.get_owned_post(token.user, post_id)
        return DeveloperPostAPI.publish_post(request, token, post)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)
