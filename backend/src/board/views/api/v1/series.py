import traceback

from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils.text import slugify

from board.models import User, Post, Series
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError
from board.modules.time import convert_to_localtime
from modules.randomness import randstr


def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = Series.objects.filter(
                owner__username=username,
                hide=False
            ).annotate(
                owner_username=F('owner__username'),
            ).order_by('order', '-id').distinct()
            
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
                    'created_date': convert_to_localtime(item.created_date).strftime('%Y년 %m월 %d일'),
                    'owner': item.owner_username,
                }, series)),
                'last_page': series.paginator.num_pages
            })

        if request.method == 'PUT':
            body = QueryDict(request.body)
            if request.GET.get('kind', '') == 'order':
                series = Series.objects.filter(owner=request.user).order_by('order')
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
            body = QueryDict(request.body)
            series = Series(
                owner=request.user,
                name=body.get('title')
            )
            series.url = slugify(series.name, allow_unicode=True)
            if series.url == '':
                series.url = randstr(15)
            i = 1
            while True:
                try:
                    series.save()
                    break
                except:
                    if i > 10:
                        traceback.print_exc()
                        return StatusError('TO', '일시적으로 오류가 발생했습니다.')
                    series.url = slugify(f'{series.name}-{randstr(8)}', allow_unicode=True)
                    i += 1
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
                        posts__config__hide=False,
                        then=1
                    )
                )
            )
        ), owner=user, url=url)
        if request.method == 'GET':
            if request.GET.get('kind', '') == 'continue':
                posts = Post.objects.filter(
                    series=series,
                    config__hide=False,
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
            posts = Post.objects.select_related(
                'content'
            ).filter(
                series=series,
                config__hide=False
            ).order_by('-created_date')
            posts = Paginator(
                objects=posts,
                offset=12,
                page=page
            )
            start_number = series.total_posts - (posts.paginator.per_page * (int(page) - 1))
            return StatusDone({
                'name': series.name,
                'url': series.url,
                'owner': series.owner_username,
                'owner_image': series.owner_avatar,
                'description': series.text_md,
                'total_posts': series.total_posts,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'number': start_number - posts.index(post),
                    'title': post.title,
                    'image': str(post.image),
                    'read_time': post.read_time,
                    'description': post.description(),
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일')
                }, posts)),
                'last_page': posts.paginator.num_pages
            })
        
        if not request.user == series.owner:
            return StatusError('DU')

        if request.method == 'PUT':
            put = QueryDict(request.body)
            series.name = put.get('title')
            series.text_md = put.get('description')

            if not series.name in series.url:
                series.url = slugify(series.name, allow_unicode=True)

            if not series.url:
                series.url = randstr(15)

            i = 1
            while True:
                try:
                    series.save()
                    break
                except:
                    if i > 10:
                        traceback.print_exc()
                        return StatusError('TO', '일시적으로 오류가 발생했습니다.')
                    series.url = slugify(f'{series.name}-{randstr(8)}', allow_unicode=True)
                    i += 1
            return StatusDone({
                'url': series.url
            })

        if request.method == 'DELETE':
            series.delete()
            return StatusDone()
        
        raise Http404
