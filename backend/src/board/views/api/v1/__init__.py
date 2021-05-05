# export
from .auth import *
from .setting import *
from .tags import *

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
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import strip_tags
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt
from PIL import Image, ImageFilter

from board.forms import *
from board.models import *
from board.module.subtask import sub_task_manager
from board.module.telegram import TelegramBot
from board.module.response import CamelizeJsonResponse
from board.views import function as fn

def posts(request, sort):
    if request.method == 'GET':
        posts = fn.get_posts(sort)
        page = request.GET.get('page', 1)
        paginator = Paginator(posts, 21)
        fn.page_check(page, paginator)
        posts = paginator.get_page(page)
        return CamelizeJsonResponse({
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
    

def user_posts(request, username, url=None):
    if not url:
        if request.method == 'GET':
            posts = Post.objects.filter(created_date__lte=timezone.now(), author__username=username, hide=False)
            all_count = posts.count()
            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tag__iregex=r'\b%s\b' % tag)
            posts = posts.order_by('-created_date')
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 10)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            return CamelizeJsonResponse({
                'all_count': all_count,
                'items': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'read_time': post.read_time(),
                    'description': post.description(35),
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages
            })
        
        if request.method == 'POST':
            if not request.user.is_active:
                return HttpResponse('error:NL')

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
            return HttpResponse(post.url)
    
    if url:
        post = get_object_or_404(Post, author__username=username, url=url)
        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                fn.compere_user(request.user, post.author, give_404_if='different')
                return CamelizeJsonResponse({
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
                
                return CamelizeJsonResponse({
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
        return HttpResponse('DONE')

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if request.GET.get('like', ''):
            if not request.user.is_active:
                return HttpResponse('error:NL')
            if request.user == post.author:
                return HttpResponse('error:SU')
            user = User.objects.get(username=request.user)
            post_like = post.likes.filter(user=user)
            if post_like.exists():
                post_like.delete()
            else:
                PostLikes(post=post, user=user).save()
                send_notify_content = '\''+ post.title +'\'글을 @'+ user.username +'님께서 추천했습니다.'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
            return HttpResponse(str(post.total_likes()))
        if request.GET.get('hide', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            post.save()
            return CamelizeJsonResponse({'is_hide': post.hide})
        if request.GET.get('tag', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.tag = fn.get_clean_tag(put.get('tag'))
            post.save()
            return CamelizeJsonResponse({'tag': post.tag})
        if request.GET.get('series', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.series = None
            post.save()
            return HttpResponse('DONE')
    
    if request.method == 'DELETE':
        fn.compere_user(request.user, post.author, give_404_if='different')
        post.delete()
        return HttpResponse('DONE')
    
    raise Http404

def user_posts_comments(request, username, url):
    post = get_object_or_404(Post, author__username=username, url=url)
    if request.method == 'GET':
        comments = Comment.objects.filter(post=post).order_by('created_date')
        return CamelizeJsonResponse({
            'comments': list(map(lambda comment: {
                'pk': comment.pk,
                'author': comment.author_username(),
                'author_image': comment.author_thumbnail(),
                'text_html': comment.get_text_html(),
                'time_since': timesince(comment.created_date),
                'is_edited': comment.edited,
                'total_likes': comment.total_likes(),
                'is_liked': comment.likes.filter(id=request.user.id).exists(),
            }, comments))
        })


def user_posts_analytics(request, username, url):
    post = get_object_or_404(Post, author__username=username, url=url)
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
        return CamelizeJsonResponse(data)

    if request.method == 'POST':
        viewonly = request.POST.get('viewonly', '')
        if viewonly:
            fn.create_viewer(post, request)
        
        referer = request.POST.get('referer', '')
        if referer:
            fn.create_referer(post, referer)
        
        return HttpResponse(randstr(1))

def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = Series.objects.filter(owner__username=username, hide=False).order_by('-created_date')
            page = request.GET.get('page', 1)
            paginator = Paginator(series, 10)
            fn.page_check(page, paginator)
            series = paginator.get_page(page)
            return CamelizeJsonResponse({
                'series': list(map(lambda item: {
                    'url': item.url,
                    'name': item.name,
                    'image': item.thumbnail(),
                    'created_date': convert_to_localtime(item.created_date).strftime('%Y년 %m월 %d일'),
                    'owner': item.owner.username,
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
                    series.url = slugify(series.name+'-'+str(i), allow_unicode=True)
                    i += 1
            return HttpResponse(series.url)
    
    if url:
        user = User.objects.get(username=username)
        series = get_object_or_404(Series, owner=user, url=url)
        if request.method == 'GET':
            if request.GET.get('type', 1):
                posts = Post.objects.filter(series=series, hide=False)
                return CamelizeJsonResponse({
                    'title': series.name,
                    'url': series.url,
                    'image': series.thumbnail(),
                    'author': user.username,
                    'author_image': user.profile.get_thumbnail(),
                    'description': series.text_md,
                    'posts': list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'read_time': post.read_time(),
                        'description': post.description(),
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일')
                    }, posts))
                })
        
        if not request.user == series.owner:
            return HttpResponse('error:DU')

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
                    series.url = slugify(series.name+'-'+str(i), allow_unicode=True)
                    i += 1
            return HttpResponse(series.url)

        if request.method == 'DELETE':
            series.delete()
            return HttpResponse('DONE')
        
        raise Http404

def temp_posts(request):
    if not request.user.is_active:
        return HttpResponse('error:NL')

    if request.method == 'GET':
        token = request.GET.get('token')
        if token:
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            return CamelizeJsonResponse(temp_posts.to_dict())

        if request.GET.get('get') == 'list':
            temps = TempPosts.objects.filter(author=request.user)
            data = {
                'result': list()
            }
            for temp in temps:
                data['result'].append({
                    'token': temp.token,
                    'title': temp.title,
                    'date': timesince(temp.created_date)
                })
            return CamelizeJsonResponse(data)

    if request.method == 'POST':
        temps = TempPosts.objects.filter(author=request.user).count()
        if temps >= 20:
            return HttpResponse('error:OF')
        
        body = QueryDict(request.body)

        token = randstr(25)
        has_token = TempPosts.objects.filter(token=token, author=request.user)
        while len(has_token) > 0:
            token = randstr(25)
            has_token = TempPosts.objects.filter(token=token, author=request.user)
        
        temp_posts = TempPosts(token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()

        return HttpResponse(token)
    
    if request.method == 'PUT':
        body = QueryDict(request.body)
        token = body.get('token')
        temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()

        return HttpResponse('DONE')
    
    if request.method == 'DELETE':
        body = QueryDict(request.body)
        token = body.get('token')
        temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
        temp_posts.delete()

        return HttpResponse('DONE')

    raise Http404

def comment(request, pk=None):
    if not pk:
        if request.method == 'POST':
            post = get_object_or_404(Post, url=request.GET.get('url'))
            body = QueryDict(request.body)
            comment = Comment(
                post=post,
                author=request.user,
                text_md=body.get('comment_md'),
                text_html=body.get('comment_html')
            )
            comment.save()
            comment.refresh_from_db()

            content = strip_tags(body.get('comment_html'))[:50]
            if not comment.author == post.author:
                send_notify_content = '\''+ post.title +'\'글에 @'+ comment.author.username +'님이 댓글을 남겼습니다. > ' + content + ' …'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
            
            regex = re.compile(r'\`\@([a-zA-Z0-9\.]*)\`\s?')
            if regex.search(comment.text_md):
                tag_user_list = regex.findall(comment.text_md)
                tag_user_list = set(tag_user_list)

                commentors = Comment.objects.filter(post=post).values_list('author__username')
                commentors = set(map(lambda instance: instance[0], commentors))

                for tag_user in tag_user_list:
                    if tag_user in commentors:
                        _user = User.objects.get(username=tag_user)
                        if not _user == request.user:
                            send_notify_content = '\''+ post.title + '\'글에서 @' + request.user.username + '님이 회원님을 태그했습니다. #' + str(comment.pk)
                            fn.create_notify(user=_user, url=post.get_absolute_url(), infomation=send_notify_content)
            
            return CamelizeJsonResponse({
                'status': 'DONE',
                'element': {
                    'pk': comment.pk,
                    'author_image': comment.author.profile.get_thumbnail(),
                    'author': comment.author.username,
                    'text_html': comment.text_html,
                    'time_since': timesince(comment.created_date),
                    'is_edited': comment.edited
                }
            })
    
    if pk:
        comment = get_object_or_404(Comment, pk=pk)

        if request.method == 'GET':
            return HttpResponse(comment.text_md)

        if request.method == 'PUT':
            put = QueryDict(request.body)
            if put.get('like'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if request.user == comment.author:
                    return HttpResponse('error:SU')
                if comment.author == None:
                    return HttpResponse('error:RJ')
                user = User.objects.get(username=request.user)
                if comment.likes.filter(id=user.id).exists():
                    comment.likes.remove(user)
                    comment.save()
                else:
                    comment.likes.add(user)
                    comment.save()
                    send_notify_content = '\''+ comment.post.title +'\'글에 작성한 회원님의 #' + str(comment.pk) + ' 댓글을 @'+ user.username +'님께서 추천했습니다.'
                    fn.create_notify(user=comment.author, url=comment.post.get_absolute_url(), infomation=send_notify_content)
                return HttpResponse(str(comment.total_likes()))
            
            if put.get('comment'):
                if not request.user == comment.author:
                    return HttpResponse('error:DU')
                comment.text_md = put.get('comment_md')
                comment.text_html = put.get('comment_html')
                comment.edited = True
                comment.save()
                return HttpResponse('DONE')
        
        if request.method == 'DELETE':
            if not request.user == comment.author:
                return HttpResponse('error:DU')
            comment.author = None
            comment.save()
            return HttpResponse('DONE')
    
    raise Http404

def feature_posts(request, tag=None):
    if not tag:
        username = request.GET.get('username', '')
        if '@' in username:
            username = username.replace('@', '')
        if not username:
            raise Http404('require username.')
        
        posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False, author__username=username)
        exclude = request.GET.get('exclude', '')
        if exclude:
            posts = posts.exclude(url=exclude)
        posts = posts.order_by('?')[:3]
        return CamelizeJsonResponse({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': post.get_thumbnail(),
                'read_time': post.read_time(),
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author.profile.get_thumbnail(),
                'author': post.author.username,
            }, posts))
        })

    if tag:
        posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False, tag__iregex=r'\b%s\b' % tag)
        exclude = request.GET.get('exclude', '')
        if exclude:
            posts = posts.exclude(url=exclude)
        posts = posts.order_by('?')[:3]
        return CamelizeJsonResponse({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': post.get_thumbnail(),
                'read_time': post.read_time(),
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author.profile.get_thumbnail(),
                'author': post.author.username,
            }, posts))
        })

def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        if request.GET.get('includes'):
            includes = request.GET.get('includes').split(',')
            user_profile = Profile.objects.get(user=user)
            data = dict()
            for include in includes:
                if include == 'profile':
                    data[include] = {
                        'image': user_profile.get_thumbnail(),
                        'username': user.username,
                        'realname': user.first_name,
                        'bio': user_profile.bio
                    }
                
                elif include == 'social':
                    data[include] = user_profile.collect_social()
                    data[include]['username'] = user.username

                elif include == 'heatmap':
                    standard_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=365)))
                    posts = Post.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, hide=False)
                    series = Series.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), owner=user)
                    comments = Comment.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, post__hide=False)
                    activity = chain(posts, series, comments)

                    heatmap = dict()
                    for element in activity:
                        key = timestamp(convert_to_localtime(element.created_date), kind='grass')[:10]
                        if key in heatmap:
                            heatmap[key] += 1
                        else:
                            heatmap[key] = 1
                    data[include] = heatmap

                elif include == 'tags':
                    data[include] = fn.get_user_topics(user=user, include='posts')
                
                elif include == 'most':
                    data[include] = list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'image': post.get_thumbnail(),
                        'read_time': post.read_time(),
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                        'author_image': post.author.profile.get_thumbnail(),
                        'author': post.author.username,
                    }, fn.get_posts('trendy', user)[:6]))
                
                elif include == 'recent':
                    seven_days_ago = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7)))
                    posts = Post.objects.filter(created_date__gte=seven_days_ago, author=user, hide=False).order_by('-created_date')
                    series = Series.objects.filter(created_date__gte=seven_days_ago, owner=user, hide=False).order_by('-created_date')
                    comments = Comment.objects.filter(created_date__gte=seven_days_ago, author=user, post__hide=False).order_by('-created_date')
                    activity = sorted(chain(posts, series, comments), key=lambda instance: instance.created_date, reverse=True)
                    data[include] = list()
                    for active in activity:
                        active_dict = dict()
                        active_type = str(type(active))
                        if 'Post' in active_type:
                            active_dict = {
                                'type': 'edit',
                                'text': active.title
                            }
                        elif 'Comment' in active_type:
                            active_dict = {
                                'type': 'comment',
                                'text': active.post.title
                            }
                        elif 'Series' in active_type:
                            active_dict = {
                                'type': 'bookmark',
                                'text': active.name
                            }
                        active_dict['url'] = active.get_absolute_url()
                        data[include].append(active_dict)
                
                elif include == 'about':
                    data[include] = user_profile.about_html
                
            return CamelizeJsonResponse(data)

        if not request.user.is_active:
            return HttpResponse('error:NL')
        
        if not request.user == user:
            return HttpResponse('error:DU')
        
        if request.GET.get('get') == 'profile':
            fields = request.GET.get('fields').split(',')
            user_profile = Profile.objects.get(user=user)
            data = dict();
            for field in fields:
                if field == 'about_md':
                    data[field] = user_profile.about_md
            return CamelizeJsonResponse(data)

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('follow'):
            if not request.user.is_active:
                return HttpResponse('error:NL')
            if request.user == user:
                return HttpResponse('error:SU')
            
            follower = User.objects.get(username=request.user)
            if hasattr(user, 'profile'):
                if user.profile.subscriber.filter(id = follower.id).exists():
                    user.profile.subscriber.remove(follower)
                else:
                    user.profile.subscriber.add(follower)
            else:
                profile = Profile(user=user)
                profile.save()
                profile.subscriber.add(follower)
            return HttpResponse(str(user.profile.total_subscriber()))
        
        if put.get('about'):
            if not request.user == user:
                return HttpResponse('error:DU')
            about_md = put.get('about_md')
            about_html = put.get('about_html')
            if hasattr(user, 'profile'):
                user.profile.about_md = about_md
                user.profile.about_html = about_html
                user.profile.save()
            else:
                profile = Profile(user=user)
                profile.about_md = about_md
                profile.about_html = about_html
                profile.save()
            
            return HttpResponse('DONE')
        
        if put.get('username'):
            if not request.user == user:
                return HttpResponse('error:DU')
            posts = Post.objects.filter(author=request.user)
            comments = Comment.objects.filter(author=request.user)
            if posts.count() > 0 or comments.count() > 0:
                return HttpResponse('error:RJ')

            new_username = put.get('new_username')
            has_username = User.objects.filter(username=new_username)
            if has_username.exists():
                return HttpResponse('error:AE')
            
            user.username = new_username
            user.save()
            return HttpResponse('DONE')
    
    raise Http404

def image_upload(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        if request.FILES['image']:
            allowed_ext = ['jpg', 'jpeg', 'png', 'gif']
            
            image = request.FILES['image']
            image_key = fn.get_hash_key(image.read())

            try:
                image_cache = ImageCache.objects.get(key=image_key)
                return HttpResponse(settings.MEDIA_URL + image_cache.path)
            except:
                image_cache = ImageCache(key=image_key)
                ext = str(image).split('.')[-1].lower()

                if not ext in allowed_ext:
                    return HttpResponse('허용된 확장자가 아닙니다.')
                    
                dt = datetime.datetime.now()
                upload_path = fn.make_path(
                    'static/images/content',
                    [
                        str(dt.year),
                        str(dt.month),
                        str(dt.day)
                    ]
                )

                file_name = str(dt.hour) + '_' + randstr(20)
                with open(upload_path + '/' + file_name + '.' + ext, 'wb+') as destination:
                    for chunk in image.chunks():
                        destination.write(chunk)
                
                if ext == 'gif':
                    try:
                        image_path = upload_path + '/' + file_name
                        convert_image = Image.open(image_path + '.' + ext).convert('RGB')
                        preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.mp4.preview.jpg', quality=50)

                        os.system('ffmpeg -i '+ upload_path + '/' + file_name + '.gif' + ' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart '+ upload_path + '/' + file_name +'.mp4')
                        os.system('rm ' + upload_path + '/' + file_name + '.gif')
                        ext = 'mp4'
                    except:
                        return HttpResponse('이미지 업로드를 실패했습니다.')
                if ext == 'png':
                    try:
                        resize_image = Image.open(upload_path + '/' + file_name + '.' + ext)
                        resize_image = resize_image.convert('RGB')

                        resize_image.thumbnail((1920, 1920), Image.ANTIALIAS)
                        resize_image.save(upload_path + '/' + file_name + '.jpg')
                        os.system('rm ' + upload_path + '/' + file_name + '.png')
                        ext = 'jpg'
                        
                        image_path = upload_path + '/' + file_name + '.' + ext
                        preview_image = resize_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.preview.jpg', quality=50)
                    except:
                        return HttpResponse('이미지 업로드를 실패했습니다.')
                else:
                    try:
                        image_path = upload_path + '/' + file_name + '.' + ext
                        resize_image = Image.open(image_path)
                        resize_image.thumbnail((1920, 1920), Image.ANTIALIAS)
                        resize_image.save(image_path)

                        if not ext == 'jpg':
                            resize_image = resize_image.convert('RGB')
                        preview_image = resize_image.filter(ImageFilter.GaussianBlur(50))
                        preview_image.save(image_path + '.preview.jpg', quality=50)
                    except:
                        return HttpResponse('이미지 업로드를 실패했습니다.')
                image_cache.path = upload_path.replace('static/', '') + '/' + file_name + '.' + ext
                image_cache.save()
                return HttpResponse(settings.MEDIA_URL + image_cache.path)
            else:
                return HttpResponse('이미지 파일이 아닙니다.')
    raise Http404

def telegram(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            print(request.body.decode("utf-8"))
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            try:
                req = json.loads(request.body.decode("utf-8"))
                req_userid = req['message']['from']['id']
                req_token = req['message']['text']
                
                telegram_sync = TelegramSync.objects.get(auth_token=req_token)
                if telegram_sync:
                    if not telegram_sync.is_token_expire():
                        telegram_sync.tid = req_userid
                        telegram_sync.auth_token = ''
                        telegram_sync.save()
                        sub_task_manager.append_task(lambda: bot.send_message(req_userid, '정상적으로 연동되었습니다.'))
                    else:
                        telegram_sync.auth_token = ''
                        telegram_sync.save()
                        sub_task_manager.append_task(lambda: bot.send_message(req_userid, '기간이 만료된 토큰입니다. 홈페이지에서 연동을 다시 시도하십시오.'))
                    
            except:
                message = '블렉스 다양한 정보를 살펴보세요!\n\n' + settings.SITE_URL + '/notion'
                sub_task_manager.append_task(lambda: bot.send_message(req_userid, message))
            return HttpResponse('None')
    
    if parameter == 'makeToken':
        if request.method == 'POST':
            token = randstr(6)
            has_token = TelegramSync.objects.filter(auth_token=token)
            while len(has_token) > 0:
                token = randstr(6)
                has_token = TelegramSync.objects.filter(auth_token=token)
            if hasattr(request.user, 'telegramsync'):
                telegramsync = request.user.telegramsync
                telegramsync.auth_token = token
                telegramsync.auth_token_exp = timezone.now()
                telegramsync.save()
                return HttpResponse(token)
            else:
                telegramsync = TelegramSync(user=request.user)
                telegramsync.auth_token = token
                telegramsync.save()
                return HttpResponse(token)
    
    if parameter == 'unsync':
        if request.method == 'POST':
            if hasattr(request.user, 'telegramsync'):
                telegramsync = request.user.telegramsync
                if not telegramsync.tid == '':
                    telegramsync.delete()
                    return HttpResponse('DONE')
            return HttpResponse('error:AU')
    
    raise Http404

def forms(request, pk=None):
    if not pk:
        if request.method == 'GET':
            user_forms = Form.objects.filter(user=request.user)
            return CamelizeJsonResponse({
                'forms': list(map(lambda form: {
                    'id': form.id,
                    'title': form.title,
                    'created_date': form.created_date,
                }, user_forms))
            })

        if request.method == 'POST':
            new_from = Form(
                user=request.user,
                title=request.POST.get('title', ''),
                content=request.POST.get('content', '')
            )
            new_from.save()
            return HttpResponse(str(new_from.id))
    
    else:
        if request.method == 'GET':
            form = get_object_or_404(Form, pk=pk)
            return CamelizeJsonResponse({
                'title': form.title,
                'content': form.content
            })
        
        if request.method == 'PUT':
            body = QueryDict(request.body)
            form = get_object_or_404(Form, pk=pk)
            form.title = body.get('title', '')
            form.content = body.get('content', '')
            form.save()
            return HttpResponse('DONE')
        
        if request.method == 'DELETE':
            form = get_object_or_404(Form, pk=pk)
            form.delete()
            return HttpResponse('DONE')
    
    raise Http404