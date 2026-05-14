from django.db.models import F, Q
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.models import User, Post, Series
from board.services import SeriesService
from board.services.series_service import SeriesValidationError
from board.services.public_post_service import PublicPostService
from board.services.public_series_service import PublicSeriesService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.series_serializer import SeriesSerializer
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode


def posts_can_add_series(request):
    if request.method == 'GET':
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.NEED_LOGIN)

        series_id = request.GET.get('series_id')
        if series_id is not None:
            try:
                parsed_series_id = int(series_id)
            except (TypeError, ValueError):
                return StatusError(ErrorCode.INVALID_PARAMETER, '유효한 시리즈 ID가 필요합니다.')

            try:
                series = Series.objects.get(id=parsed_series_id, owner=request.user)
            except Series.DoesNotExist:
                return StatusError(ErrorCode.NOT_FOUND, '시리즈를 찾을 수 없습니다.')

            posts = Post.objects.filter(
                author=request.user
            ).filter(
                Q(series=series) | (
                    Q(series__isnull=True) & PublicPostService.build_public_filter()
                )
            ).order_by('-published_date', '-id')
        else:
            posts = SeriesService.get_posts_available_for_series(request.user)

        return StatusDone([
            SeriesSerializer.available_post(post)
            for post in posts
        ])

    raise Http404


def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = SeriesService.get_public_series_list(username)
            series = Paginator(
                objects=series,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'series': [
                    SeriesSerializer.public_series_list_item(item)
                    for item in series
                ],
                'last_page': series.paginator.num_pages
            })

        if request.method == 'PUT':
            body = QueryDict(request.body)
            if request.GET.get('kind', '') == 'order':
                try:
                    items = body.get('series').split(',')
                    order_data = []
                    for item in items:
                        parts = item.split('=')
                        if len(parts) == 2:
                            url_part, order = parts
                            series_item = Series.objects.filter(
                                owner=request.user,
                                url=url_part
                            ).first()
                            if series_item:
                                order_data.append((series_item.id, int(order)))

                    SeriesService.update_series_order(request.user, order_data)

                    series = SeriesService.get_user_series_list(request.user)
                    return StatusDone({
                        'series': [
                            SeriesSerializer.owner_series_order_item(item)
                            for item in series
                        ]
                    })
                except SeriesValidationError as e:
                    return StatusError(e.code, e.message)

        if request.method == 'POST':
            body = ApiRequestBodyService.parse_json_or_querydict(request)

            try:
                post_ids = []
                if body.get('post_ids', ''):
                    if isinstance(body.get('post_ids'), str):
                        post_ids = [int(pid) for pid in body.get('post_ids').split(',') if pid]
                    else:
                        post_ids = [int(pid) for pid in body.get('post_ids') if pid]

                series = SeriesService.create_series(
                    user=request.user,
                    name=body.get('title', ''),
                    url='',  # Will be auto-generated
                    description=body.get('description', ''),
                    post_ids=post_ids
                )

                return StatusDone({
                    'url': series.url
                })
            except SeriesValidationError as e:
                return StatusError(e.code, e.message)

    if url:
        user = get_object_or_404(User, username=username)
        series_queryset = Series.objects.annotate(
            owner_username=F('owner__username'),
            owner_avatar=F('owner__profile__avatar'),
        )

        if request.method == 'GET':
            series = get_object_or_404(
                PublicSeriesService.filter_public_series(series_queryset, 'total_posts'),
                owner=user,
                url=url,
            )
            if request.GET.get('kind', '') == 'continue':
                posts = PublicPostService.filter_public_posts(Post.objects).filter(
                    series=series,
                ).values_list('title', 'url')
                return StatusDone(SeriesSerializer.public_continue_detail(series, posts))

            page = request.GET.get('page', 1)
            order = request.GET.get('order', 'latest')
            posts = PublicPostService.filter_public_posts(
                Post.objects.select_related('content')
            ).filter(
                series=series,
            ).order_by('-published_date' if order == 'latest' else 'published_date')
            posts = Paginator(
                objects=posts,
                offset=12,
                page=page
            )
            return StatusDone(
                SeriesSerializer.public_detail(series, posts, int(page), order)
            )

        series = get_object_or_404(
            PublicSeriesService.with_public_post_count(series_queryset, 'total_posts'),
            owner=user,
            url=url,
        )

        if not SeriesService.can_user_edit_series(request.user, series):
            return StatusError(ErrorCode.AUTHENTICATION)

        if request.method == 'PUT':
            put = ApiRequestBodyService.parse_json_or_querydict(request)

            try:
                post_ids = None
                if put.get('post_ids'):
                    if isinstance(put.get('post_ids'), str):
                        post_ids = [int(pid) for pid in put.get('post_ids').split(',') if pid]
                    else:
                        post_ids = [int(pid) for pid in put.get('post_ids') if pid]

                SeriesService.update_series(
                    series=series,
                    name=put.get('title'),
                    description=put.get('description'),
                    post_ids=post_ids
                )

                return StatusDone({
                    'url': series.url
                })
            except SeriesValidationError as e:
                return StatusError(e.code, e.message)

        if request.method == 'DELETE':
            SeriesService.delete_series(series)
            return StatusDone()

        raise Http404


def series_order(request):
    """
    Update series order for the current user.
    Expects JSON data with 'order' field containing array of [id, order] pairs.
    """
    if request.method == 'PUT':
        body, body_error = ApiRequestBodyService.parse_json_or_error(
            request,
            error_code=ErrorCode.INVALID_PARAMETER,
            message='잘못된 요청 데이터입니다.',
        )
        if body_error:
            return body_error

        order_data = body.get('order', [])
        if not order_data:
            return StatusError(ErrorCode.INVALID_PARAMETER, '순서 정보가 필요합니다.')

        try:
            order_tuples = [(item[0], item[1]) for item in order_data if len(item) >= 2]
            SeriesService.update_series_order(request.user, order_tuples)
            return StatusDone({'message': '시리즈 순서가 변경되었습니다.'})
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def series_create_update(request):
    """
    Get series list (GET) or Create new series (POST) for the current user.
    """
    if request.method == 'GET':
        try:
            SeriesService.validate_user_permissions(request.user)
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

        series = SeriesService.get_user_series_list(request.user)

        return StatusDone({
            'series': [
                SeriesSerializer.owner_series_list_item(item)
                for item in series
            ]
        })

    elif request.method == 'POST':
        body, body_error = ApiRequestBodyService.parse_json_or_error(
            request,
            error_code=ErrorCode.INVALID_PARAMETER,
            message='잘못된 요청 데이터입니다.',
        )
        if body_error:
            return body_error

        try:
            post_ids = None
            if 'post_ids' in body:
                raw_post_ids = body.get('post_ids')
                if isinstance(raw_post_ids, str):
                    post_ids = [int(pid) for pid in raw_post_ids.split(',') if pid]
                elif isinstance(raw_post_ids, list):
                    post_ids = [int(pid) for pid in raw_post_ids if pid]
                else:
                    post_ids = []

            series = SeriesService.create_series(
                user=request.user,
                name=body.get('name', ''),
                url=body.get('url', ''),
                description=body.get('description', ''),
                post_ids=post_ids
            )

            return StatusDone(
                SeriesSerializer.mutation_detail(
                    series,
                    thumbnail=body.get('thumbnail', ''),
                )
            )
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def series_detail(request, series_id):
    """
    Get (GET), update (PUT), or delete (DELETE) a specific series by ID.
    """
    try:
        SeriesService.validate_user_permissions(request.user)
    except SeriesValidationError as e:
        return StatusError(e.code, e.message)

    try:
        series = Series.objects.get(id=series_id, owner=request.user)
    except Series.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, '시리즈를 찾을 수 없습니다.')

    if request.method == 'GET':
        post_ids = list(
            Post.objects.filter(
                author=request.user,
                series=series
            ).values_list('id', flat=True)
        )

        return StatusDone(SeriesSerializer.owner_detail(series, post_ids))

    if request.method == 'PUT':
        body, body_error = ApiRequestBodyService.parse_json_or_error(
            request,
            error_code=ErrorCode.INVALID_PARAMETER,
            message='잘못된 요청 데이터입니다.',
        )
        if body_error:
            return body_error

        try:
            post_ids = None
            if 'post_ids' in body:
                raw_post_ids = body.get('post_ids')
                if isinstance(raw_post_ids, str):
                    post_ids = [int(pid) for pid in raw_post_ids.split(',') if pid]
                elif isinstance(raw_post_ids, list):
                    post_ids = [int(pid) for pid in raw_post_ids if pid]
                else:
                    post_ids = []

            SeriesService.update_series(
                series=series,
                name=body.get('name'),
                url=body.get('url'),
                description=body.get('description'),
                post_ids=post_ids
            )

            return StatusDone(
                SeriesSerializer.mutation_detail(
                    series,
                    thumbnail=body.get('thumbnail', ''),
                )
            )
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

    elif request.method == 'DELETE':
        SeriesService.delete_series(series)
        return StatusDone({'message': '시리즈가 삭제되었습니다.'})

    raise Http404
