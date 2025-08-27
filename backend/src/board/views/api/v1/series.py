import json
from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import User, Post, Series
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime


def posts_can_add_series(request):
    if request.method == 'GET':
        if not request.user:
            raise Http404

        posts = Post.objects.filter(
            author=request.user,
            series=None,
            config__hide=False,
            created_date__lte=timezone.now()
        ).order_by('-created_date')
        return StatusDone(list(map(lambda post: {
            'id': post.id,
            'title': post.title,
        }, posts)))
    
    raise Http404

def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = Series.objects.annotate(
                owner_username=F('owner__username'),
                total_posts=Count(
                    Case(
                        When(
                            posts__created_date__lte=timezone.now(),
                            posts__config__hide=False,
                            then=1
                        )
                    )
                )
            ).filter(
                owner__username=username,
                total_posts__gte=1,
                hide=False,
            ).order_by('order', '-id')

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
                series = Series.objects.filter(
                    owner=request.user).order_by('order')
                prev_state = {}

                for item in series:
                    prev_state[item.url] = (item.order, item)

                items = body.get('series').split(',')
                for item in items:
                    [url, next_order] = item.split('=')
                    [prev_order, series_item] = prev_state[url]
                    if int(prev_order) != int(next_order):
                        series_item.order = next_order
                        series_item.save()

                series = Series.objects.filter(
                    owner=request.user
                ).annotate(
                    total_posts=Count('posts')
                ).order_by('order')
                return StatusDone({
                    'series': list(map(lambda item: {
                        'url': item.url,
                        'title': item.name,
                        'total_posts': item.total_posts
                    }, series))
                })

        if request.method == 'POST':
            try:
                body = json.loads(request.body)
            except:
                body = QueryDict(request.body)

            if not body.get('title', ''):
                return StatusError(ErrorCode.REQUIRE, '제목을 입력해주세요.')

            series = Series(
                owner=request.user,
                name=body.get('title'),
                text_md=body.get('description', ''),
                text_html=body.get('description', ''),
            )
            series.save()

            if body.get('post_ids', ''):
                if isinstance(body.get('post_ids'), str):
                    post_ids = body.get('post_ids').split(',')
                else:
                    post_ids = body.get('post_ids')
                    
                for post_id in post_ids:
                    if post_id:  # Empty string check
                        post = Post.objects.get(id=post_id)
                        post.series = series
                        post.save()

            return StatusDone({
                'url': series.url
            })

    if url:
        user = get_object_or_404(User, username=username)
        series = get_object_or_404(Series.objects.annotate(
            owner_username=F('owner__username'),
            owner_avatar=F('owner__profile__avatar'),
            total_posts=Count(
                Case(
                    When(
                        posts__created_date__lte=timezone.now(),
                        posts__config__hide=False,
                        then=1
                    )
                )
            )
        ), owner=user, url=url)

        if request.method == 'GET':
            if request.GET.get('kind', '') == 'continue':
                posts = Post.objects.filter(
                    created_date__lte=timezone.now(),
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
                created_date__lte=timezone.now(),
                config__hide=False,
                series=series,
            ).order_by('-created_date' if order == 'latest' else 'created_date')
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
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일')
                }, posts)),
                'last_page': posts.paginator.num_pages
            })

        if not request.user == series.owner:
            return StatusError(ErrorCode.AUTHENTICATION)

        if request.method == 'PUT':
            try:
                put = json.loads(request.body)
            except:
                put = QueryDict(request.body)
                
            series.name = put.get('title')
            series.text_md = put.get('description')
            series.save()
            
            # Handle post_ids if provided
            if put.get('post_ids'):
                # Remove all current posts from series
                Post.objects.filter(series=series).update(series=None)
                
                # Add selected posts to series
                if isinstance(put.get('post_ids'), str):
                    post_ids = put.get('post_ids').split(',') if put.get('post_ids') else []
                else:
                    post_ids = put.get('post_ids')
                    
                for post_id in post_ids:
                    if post_id:  # Empty string check
                        try:
                            post = Post.objects.get(id=post_id, author=request.user)
                            post.series = series
                            post.save()
                        except Post.DoesNotExist:
                            pass  # Skip invalid post IDs

            return StatusDone({
                'url': series.url
            })

        if request.method == 'DELETE':
            series.delete()
            return StatusDone()

        raise Http404


def series_order(request):
    """
    Update series order for the current user.
    Expects JSON data with 'order' field containing array of [id, order] pairs.
    """
    if request.method == 'PUT':
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.AUTHENTICATION)
            
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')
        
        order_data = body.get('order', [])
        if not order_data:
            return StatusError(ErrorCode.INVALID_PARAMETER, '순서 정보가 필요합니다.')
        
        # Update series order
        for item in order_data:
            if len(item) >= 2:
                series_id, new_order = item[0], item[1]
                try:
                    series = Series.objects.get(id=series_id, owner=request.user)
                    series.order = new_order
                    series.save()
                except Series.DoesNotExist:
                    pass  # Skip invalid series IDs
        
        return StatusDone({'message': '시리즈 순서가 변경되었습니다.'})
    
    raise Http404


def series_create_update(request):
    """
    Create new series (POST) for the current user.
    """
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.AUTHENTICATION)
            
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')
        
        name = body.get('name', '').strip()
        url = body.get('url', '').strip()
        description = body.get('description', '').strip()
        thumbnail = body.get('thumbnail', '').strip()
        
        if not name:
            return StatusError(ErrorCode.REQUIRE, '시리즈 이름을 입력해주세요.')
        
        if not url:
            return StatusError(ErrorCode.REQUIRE, 'URL을 입력해주세요.')
        
        # Check if URL is unique for this user
        if Series.objects.filter(owner=request.user, url=url).exists():
            return StatusError(ErrorCode.DUPLICATE, '이미 존재하는 URL입니다.')
        
        # Create series
        series = Series(
            owner=request.user,
            name=name,
            url=url,
            text_md=description,
            text_html=description
        )
        
        if thumbnail:
            # Handle thumbnail upload - for now just store the URL
            # You might want to validate and process the thumbnail here
            pass
            
        series.save()
        
        return StatusDone({
            'id': series.id,
            'name': series.name,
            'url': series.url,
            'description': series.text_md,
            'thumbnail': thumbnail,
            'postCount': 0
        })
    
    raise Http404


def series_detail(request, series_id):
    """
    Update (PUT) or delete (DELETE) a specific series by ID.
    """
    if not request.user.is_authenticated:
        return StatusError(ErrorCode.AUTHENTICATION)
        
    try:
        series = Series.objects.get(id=series_id, owner=request.user)
    except Series.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, '시리즈를 찾을 수 없습니다.')
    
    if request.method == 'PUT':
        try:
            body = json.loads(request.body)
        except:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 요청 데이터입니다.')
        
        name = body.get('name', '').strip()
        url = body.get('url', '').strip()
        description = body.get('description', '').strip()
        thumbnail = body.get('thumbnail', '').strip()
        
        if not name:
            return StatusError(ErrorCode.REQUIRE, '시리즈 이름을 입력해주세요.')
        
        if not url:
            return StatusError(ErrorCode.REQUIRE, 'URL을 입력해주세요.')
        
        # Check if URL is unique for this user (excluding current series)
        if Series.objects.filter(owner=request.user, url=url).exclude(id=series_id).exists():
            return StatusError(ErrorCode.DUPLICATE, '이미 존재하는 URL입니다.')
        
        # Update series
        series.name = name
        series.url = url
        series.text_md = description
        series.text_html = description
        # Handle thumbnail update here if needed
        series.save()
        
        return StatusDone({
            'id': series.id,
            'name': series.name,
            'url': series.url,
            'description': series.text_md,
            'thumbnail': thumbnail,
            'postCount': series.posts.count()
        })
    
    elif request.method == 'DELETE':
        series.delete()
        return StatusDone({'message': '시리즈가 삭제되었습니다.'})
    
    raise Http404
