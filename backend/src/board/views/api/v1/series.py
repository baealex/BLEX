import traceback

from django.core.paginator import Paginator
from django.db.models import F
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify

from board.models import *
from modules.response import StatusDone, StatusError
from board.views import function as fn

def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = Series.objects.filter(
                owner__username=username,
                hide=False
            ).annotate(
                owner_username=F('owner__username')
            ).order_by('-created_date')
            page = request.GET.get('page', 1)
            paginator = Paginator(series, 10)
            fn.page_check(page, paginator)
            series = paginator.get_page(page)
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
                    if i > 1000:
                        traceback.print_exc()
                        return StatusError('TO', '일시적으로 오류가 발생했습니다.')
                    series.url = slugify(series.name+'-'+str(i), allow_unicode=True)
                    i += 1
            return StatusDone({
                'url': series.url
            })
    
    if url:
        user = get_object_or_404(User, username=username)
        series = get_object_or_404(Series.objects.annotate(
            owner_username=F('owner__username'),
            owner_avatar=F('owner__profile__avatar'),
        ), owner=user, url=url)
        if request.method == 'GET':
            if request.GET.get('type', 1):
                posts = Post.objects.select_related(
                    'content'
                ).filter(
                    series=series,
                    config__hide=False
                )
                return StatusDone({
                    'name': series.name,
                    'url': series.url,
                    'image': series.thumbnail(),
                    'owner': series.owner_username,
                    'owner_image': series.owner_avatar,
                    'description': series.text_md,
                    'posts': list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'read_time': post.read_time,
                        'description': post.description(),
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일')
                    }, posts))
                })
        
        if not request.user == series.owner:
            return StatusError('DU')

        if request.method == 'PUT':
            put = QueryDict(request.body)
            series.name = put.get('title')
            series.text_md = put.get('description')
            series.url = slugify(series.name, allow_unicode=True)
            if series.url == '':
                series.url = randstr(15)
            i = 1
            while True:
                try:
                    series.save()
                    break
                except:
                    if i > 1000:
                        traceback.print_exc()
                        return StatusError('TO', '일시적으로 오류가 발생했습니다.')
                    series.url = slugify(series.name+'-'+str(i), allow_unicode=True)
                    i += 1
            return StatusDone({
                'url': series.url
            })

        if request.method == 'DELETE':
            series.delete()
            return StatusDone()
        
        raise Http404