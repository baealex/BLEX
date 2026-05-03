from django.db.models import Count, Q
from django.http import Http404
from django.views.decorators.csrf import csrf_exempt

from board.models import Series, Tag
from board.modules.developer_response import DeveloperResponse
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
from board.views.api.developer.v1.post import DeveloperPostAPI


class DeveloperPublishingAPI:
    @staticmethod
    def tags_param(request):
        tags = []
        for value in request.GET.getlist('tag'):
            tags.extend(value.split(','))
        return [tag.strip() for tag in tags if tag.strip()]

    @staticmethod
    def filter_by_search_query(queryset, query):
        query = (query or '').strip()
        if not query:
            return queryset

        return queryset.filter(
            Q(title__icontains=query)
            | Q(subtitle__icontains=query)
            | Q(url__icontains=query)
            | Q(meta_description__icontains=query)
            | Q(tags__value__icontains=query)
            | Q(content__content_html__icontains=query)
        )

    @staticmethod
    def filter_by_series_id(queryset, series_id):
        if series_id in (None, ''):
            return queryset

        try:
            series_id = int(series_id)
        except (TypeError, ValueError):
            raise DeveloperAuthError(
                'request.invalid_series_id',
                'series_id는 숫자여야 합니다.',
                400,
            )

        return queryset.filter(series_id=series_id)

    @staticmethod
    def search_posts(request, token):
        queryset = DeveloperPostAPI.post_queryset(token.user)
        queryset = DeveloperPublishingAPI.filter_by_search_query(
            queryset,
            request.GET.get('q', ''),
        )
        queryset = DeveloperPostAPI.status_filter(
            queryset,
            request.GET.get('status', ''),
        )
        queryset = DeveloperPublishingAPI.filter_by_series_id(
            queryset,
            request.GET.get('series_id'),
        )

        tags = DeveloperPublishingAPI.tags_param(request)
        if tags:
            queryset = queryset.filter(tags__value__in=tags)

        queryset = queryset.distinct().order_by('-updated_date')
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
    def list_tags(request, token):
        tags = Tag.objects.filter(
            posts__author=token.user,
        ).annotate(
            post_count=Count(
                'posts',
                filter=Q(posts__author=token.user),
                distinct=True,
            ),
        ).order_by(
            'value',
        ).distinct()

        response = DeveloperResponse.success({
            'tags': [
                DeveloperTagSerializer.serialize(tag)
                for tag in tags
            ],
        })
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def list_series(request, token):
        series = Series.objects.filter(
            owner=token.user,
        ).annotate(
            post_count=Count('posts', distinct=True),
        ).order_by(
            'order',
            'name',
            'id',
        )

        response = DeveloperResponse.success({
            'series': [
                DeveloperSeriesSerializer.serialize(item)
                for item in series
            ],
        })
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response

    @staticmethod
    def upload_image(request, token):
        try:
            url = ImageUploadService.upload_content_image(
                request.FILES.get('image'),
                user=token.user,
            )
        except ImageUploadError as error:
            status = 422 if error.code == 'image.upload_failed' else 400
            response = DeveloperResponse.error(
                error.code,
                error.message,
                status,
            )
            DeveloperTokenService.record_request(request, token, response.status_code)
            return response

        response = DeveloperResponse.success({
            'url': url,
        }, status=201)
        DeveloperTokenService.record_request(request, token, response.status_code)
        return response


@csrf_exempt
def search_posts(request):
    if request.method != 'GET':
        raise Http404

    try:
        token = DeveloperPostAPI.authenticate(request, 'posts:read')
        return DeveloperPublishingAPI.search_posts(request, token)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)


@csrf_exempt
def tags(request):
    if request.method != 'GET':
        raise Http404

    try:
        token = DeveloperPostAPI.authenticate(request, 'posts:read')
        return DeveloperPublishingAPI.list_tags(request, token)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)


@csrf_exempt
def series(request):
    if request.method != 'GET':
        raise Http404

    try:
        token = DeveloperPostAPI.authenticate(request, 'posts:read')
        return DeveloperPublishingAPI.list_series(request, token)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)


@csrf_exempt
def images(request):
    if request.method != 'POST':
        raise Http404

    try:
        token = DeveloperPostAPI.authenticate(request, 'posts:write')
        return DeveloperPublishingAPI.upload_image(request, token)
    except DeveloperAuthError as error:
        return DeveloperPostAPI.auth_error(error)
