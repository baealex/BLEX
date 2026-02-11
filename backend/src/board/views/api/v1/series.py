import json
from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import User, Post, Series
from board.services import SeriesService
from board.services.series_service import SeriesValidationError
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime


def posts_can_add_series(request):
    if request.method == 'GET':
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.NEED_LOGIN)

        posts = SeriesService.get_posts_available_for_series(request.user)
        return StatusDone(list(map(lambda post: {
            'id': post.id,
            'title': post.title,
        }, posts)))

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
                'series': list(map(lambda item: {
                    'url': item.url,
                    'name': item.name,
                    'image': item.thumbnail(),
                    'total_posts': item.total_posts,
                    'created_date': convert_to_localtime(item.created_date).strftime('%Y년 %m월 %d일'),
                    'owner': item.owner_username,
                }, series)),
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
                        'series': list(map(lambda item: {
                            'url': item.url,
                            'title': item.name,
                            'total_posts': item.total_posts
                        }, series))
                    })
                except SeriesValidationError as e:
                    return StatusError(e.code, e.message)

        if request.method == 'POST':
            try:
                body = json.loads(request.body)
            except:
                body = QueryDict(request.body)

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
        series = get_object_or_404(Series.objects.annotate(
            owner_username=F('owner__username'),
            owner_avatar=F('owner__profile__avatar'),
            total_posts=Count(
                Case(
                    When(
                        posts__published_date__isnull=False,
                        posts__published_date__lte=timezone.now(),
                        posts__config__hide=False,
                        then=1
                    )
                )
            )
        ), owner=user, url=url)

        if request.method == 'GET':
            if request.GET.get('kind', '') == 'continue':
                posts = Post.objects.filter(
                    published_date__isnull=False,
                    published_date__lte=timezone.now(),
                    config__hide=False,
                    series=series,
                ).values_list('title', 'url')
                return StatusDone({
                    'name': series.name,
                    'url': series.url,
                    'owner': series.owner_username,
                    'owner_image': series.owner_avatar,
                    'description': series.text_md,
                    'total_posts': series.total_posts,
                    'posts': list(map(lambda post: {
                        'title': post[0],
                        'url': post[1],
                    }, posts)),
                })

            page = request.GET.get('page', 1)
            order = request.GET.get('order', 'latest')
            posts = Post.objects.select_related(
                'content'
            ).filter(
                published_date__isnull=False,
                published_date__lte=timezone.now(),
                config__hide=False,
                series=series,
            ).order_by('-published_date' if order == 'latest' else 'published_date')
            posts = Paginator(
                objects=posts,
                offset=12,
                page=page
            )
            start_number = series.total_posts - \
                (posts.paginator.per_page * (int(page) - 1))
            return StatusDone({
                'name': series.name,
                'url': series.url,
                'owner': series.owner_username,
                'owner_image': series.owner_avatar,
                'description': series.text_md,
                'total_posts': series.total_posts,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'number': start_number - posts.index(post) if order == 'latest' else posts.index(post) + 1 + (int(page) - 1) * posts.paginator.per_page,
                    'title': post.title,
                    'image': str(post.image),
                    'read_time': post.read_time,
                    'description': post.meta_description,
                    'created_date': convert_to_localtime(post.published_date).strftime('%Y년 %m월 %d일')
                }, posts)),
                'last_page': posts.paginator.num_pages
            })

        if not SeriesService.can_user_edit_series(request.user, series):
            return StatusError(ErrorCode.AUTHENTICATION)

        if request.method == 'PUT':
            try:
                put = json.loads(request.body)
            except:
                put = QueryDict(request.body)

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
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')

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
            'series': list(map(lambda item: {
                'id': str(item.id),
                'name': item.name,
                'url': item.url,
                'total_posts': item.total_posts,
                'created_date': convert_to_localtime(item.created_date).strftime('%Y년 %m월 %d일'),
            }, series))
        })

    elif request.method == 'POST':
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')

        try:
            series = SeriesService.create_series(
                user=request.user,
                name=body.get('name', ''),
                url=body.get('url', ''),
                description=body.get('description', '')
            )

            return StatusDone({
                'id': series.id,
                'name': series.name,
                'url': series.url,
                'description': series.text_md,
                'thumbnail': body.get('thumbnail', ''),
                'postCount': 0
            })
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def series_detail(request, series_id):
    """
    Update (PUT) or delete (DELETE) a specific series by ID.
    """
    try:
        SeriesService.validate_user_permissions(request.user)
    except SeriesValidationError as e:
        return StatusError(e.code, e.message)

    try:
        series = Series.objects.get(id=series_id, owner=request.user)
    except Series.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, '시리즈를 찾을 수 없습니다.')

    if request.method == 'PUT':
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')

        try:
            SeriesService.update_series(
                series=series,
                name=body.get('name'),
                url=body.get('url'),
                description=body.get('description')
            )

            return StatusDone({
                'id': series.id,
                'name': series.name,
                'url': series.url,
                'description': series.text_md,
                'thumbnail': body.get('thumbnail', ''),
                'postCount': series.posts.count()
            })
        except SeriesValidationError as e:
            return StatusError(e.code, e.message)

    elif request.method == 'DELETE':
        SeriesService.delete_series(series)
        return StatusDone({'message': '시리즈가 삭제되었습니다.'})

    raise Http404
