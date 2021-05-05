import os
import re
import json
import time
import traceback

from itertools import chain
from django.conf import settings
from django.contrib import auth
from django.core.cache import cache
from django.core.files import File
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.http import HttpResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import strip_tags
from django.utils.timesince import timesince

from board.models import *
from board.module.subtask import sub_task_manager
from board.module.telegram import TelegramBot
from board.module.response import StatusDone, StatusError
from board.module.analytics import view_count
from board.views import function as fn

def posts(request, url=None):
    if not url:
        if request.method == 'GET':
            sort = request.GET.get('sort', 'trendy')
            posts = fn.get_posts(sort)

            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 21)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            return StatusDone({
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'description': post.description(),
                    'read_time': post.read_time(),
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                }, posts)),
                'last_page': posts.paginator.num_pages
            })

        if request.method == 'POST':
            if not request.user.is_active:
                return StatusError('NL')

            post = Post()
            post.title = request.POST.get('title', '')
            post.author = request.user
            post.text_md = request.POST.get('text_md', '')
            post.text_html = request.POST.get('text_html', '')
            post.hide = True if request.POST.get('is_hide', '') == 'true' else False
            post.advertise = True if request.POST.get('is_advertise', '') == 'true' else False

            try:
                series_url = request.POST.get('series', '')
                if series_url:
                    series = Series.objects.get(owner=request.user, url=series_url)
                    post.series = series
            except:
                pass

            try:
                post.image = request.FILES['image']
            except:
                pass
            
            post.tag = fn.get_clean_tag(request.POST.get('tag', ''))[:50]
            post.url = slugify(post.title, allow_unicode=True)
            if post.url == '':
                post.url = randstr(15)
            i = 1
            while True:
                try:
                    post.save()
                    break
                except:
                    post.url = slugify(post.title+'-'+str(i), allow_unicode=True)
                    i += 1

            token = request.POST.get('token')
            if token:
                try:
                    TempPosts.objects.get(token=token, author=request.user).delete()
                except:
                    pass
            return StatusDone({
                'url': post.url,
            })
    
    if url:
        post = get_object_or_404(Post, url=url)
        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                fn.compere_user(request.user, post.author, give_404_if='different')
                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'series': post.series.url if post.series else None,
                    'text_md': post.text_md,
                    'tag': post.tag,
                    'is_hide': post.hide,
                    'is_advertise': post.advertise
                })

            if request.GET.get('mode') == 'view':
                if post.hide and request.user != post.author:
                    raise Http404
                
                return StatusDone({
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'description': post.description_tag(),
                    'read_time': post.read_time(),
                    'series': post.series.url if post.series else None,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                    'text_html': post.text_html,
                    'total_likes': post.total_likes(),
                    'total_comment': post.total_comment(),
                    'tag': post.tag,
                    'is_liked': post.likes.filter(user__id=request.user.id).exists()
                })

    if request.method == 'POST':
        fn.compere_user(request.user, post.author, give_404_if='different')
        post.title = request.POST.get('title', '')
        post.text_md = request.POST.get('text_md', '')
        post.text_html = request.POST.get('text_html', '')
        post.hide = True if request.POST.get('is_hide', '') == 'true' else False
        post.advertise = True if request.POST.get('is_advertise', '') == 'true' else False
        post.updated_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))

        try:
            series_url = request.POST.get('series', '')
            if series_url:
                series = Series.objects.get(owner=request.user, url=series_url)
                post.series = series
        except:
            pass
        
        try:
            post.image = request.FILES['image']
        except:
            pass

        post.tag = fn.get_clean_tag(request.POST.get('tag', ''))
        post.save()
        return StatusDone()

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if request.GET.get('like', ''):
            if not request.user.is_active:
                return StatusError('NL')
            if request.user == post.author:
                return StatusError('SU')
            user = User.objects.get(username=request.user)
            post_like = post.likes.filter(user=user)
            if post_like.exists():
                post_like.delete()
            else:
                PostLikes(post=post, user=user).save()
                send_notify_content = '\''+ post.title +'\'글을 @'+ user.username +'님께서 추천했습니다.'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
            return StatusDone({
                'total_likes': post.total_likes()
            })
        if request.GET.get('hide', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            post.save()
            return StatusDone({
                'is_hide': post.hide
            })
        if request.GET.get('tag', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.tag = fn.get_clean_tag(put.get('tag'))
            post.save()
            return StatusDone({
                'tag': post.tag
            })
        if request.GET.get('series', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.series = None
            post.save()
            return StatusDone()
    
    if request.method == 'DELETE':
        fn.compere_user(request.user, post.author, give_404_if='different')
        post.delete()
        return StatusDone()
    
    raise Http404

def posts_comments(request, url):
    post = get_object_or_404(Post, url=url)
    if request.method == 'GET':
        comments = Comment.objects.filter(post=post).order_by('created_date')
        return StatusDone({
            'comments': list(map(lambda comment: {
                'pk': comment.pk,
                'author': comment.author_username(),
                'author_image': comment.author_thumbnail(),
                'is_edited': comment.edited,
                'text_html': comment.get_text_html(),
                'time_since': timesince(comment.created_date),
                'total_likes': comment.total_likes(),
                'is_liked': comment.likes.filter(id=request.user.id).exists(),
            }, comments))
        })

def posts_analytics(request, url):
    post = get_object_or_404(Post, url=url)
    if request.method == 'GET':
        if request.user != post.author:
            raise Http404
        
        seven_days_ago  = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7)))
        posts_analytics = PostAnalytics.objects.filter(posts__id=post.pk, created_date__gt=seven_days_ago).order_by('-created_date')
        posts_referers = Referer.objects.filter(posts__posts__id=post.pk, created_date__gt=seven_days_ago).order_by('-created_date')[:30]

        data = {
            'items': [],
            'referers': [],
        }
        for item in posts_analytics:
            data['items'].append({
                'date': item.created_date,
                'count': item.table.count()
            })
        for referer in posts_referers:
            data['referers'].append({
                'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                'from': referer.referer_from.location,
                'title': referer.referer_from.title
            })
        return StatusDone(data)

    if request.method == 'POST':
        ip = request.POST.get('ip', '')
        user_agent = request.POST.get('user_agent', '')
        referer = request.POST.get('referer', '')
        time = request.POST.get('time', '')

        view_count(post, request, ip, user_agent, referer)
        
        return StatusDone()