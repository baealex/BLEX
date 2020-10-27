import os
import re
import json
import time
import random

from itertools import chain
from django.db.models import Count, Q
from django.core.cache import cache
from django.core.files import File
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.contrib import auth
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import render, get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from PIL import Image, ImageFilter

from board.models import *
from board.forms import *
from board.telegram import TelegramBot
from board.views import function as fn

def alive(request):
    if request.method == 'GET':
        if request.user.is_active:
            notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
            result = {
                'username': request.user.username,
                'notify_count': notify.count()
            }
            return JsonResponse(result, json_dumps_params={'ensure_ascii': True})
        return HttpResponse('dead')

def login(request):
    if request.method == 'POST':
        social = request.POST.get('social', '')
        if not social:
            username = request.POST.get('username', '')
            password = request.POST.get('password', '')
            
            user = auth.authenticate(username=username, password=password)

            if user is not None:
                if user.is_active:
                    auth.login(request, user)
                    notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
                    return JsonResponse({
                        'status': 'success',
                        'username': username,
                        'notify_count': notify.count()
                    }, json_dumps_params={'ensure_ascii': True})
            result = {
                'status': 'failure'
            }
            return JsonResponse(result, json_dumps_params={'ensure_ascii': True})


        if social == 'github':
            if request.POST.get('code'):
                state = fn.auth_github(request.POST.get('code'))
                if state['status']:
                    node_id = state['user'].get('node_id')
                    try:
                        user = User.objects.get(last_name='github:' + str(node_id))
                        auth.login(request, user)
                        notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
                        return JsonResponse({
                            'status': 'success',
                            'username': user.username,
                            'notify_count': notify.count()
                        }, json_dumps_params={'ensure_ascii': True})
                    except:
                        pass
                        
                    counter = 0
                    username = state['user'].get('login')
                    has_name = User.objects.filter(username=username)
                    while len(has_name) > 0:
                        has_name = User.objects.filter(username=username + str(counter))
                        counter += 1
                    
                    username = username + str('' if counter == 0 else counter)
                    new_user = User(username=username)
                    new_user.first_name = state['user'].get('name')
                    new_user.last_name = 'github:' + str(node_id)
                    new_user.email = state['user'].get('email')
                    new_user.is_active = True
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = fn.get_image(state['user'].get('avatar_url'))
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.github = state['user'].get('login')
                    profile.save()

                    config = Config(user=new_user)
                    config.save()

                    auth.login(request, new_user)
                    return JsonResponse({
                        'status': 'success',
                        'username': username,
                        'notify_count': 1
                    }, json_dumps_params={'ensure_ascii': True})
                else:
                    return JsonResponse({
                        'status': 'failure',
                        'message': '요청중 에러 발생'
                    }, json_dumps_params={'ensure_ascii': True})
        
        if social == 'google':
            if request.POST.get('code'):
                state = fn.auth_google(request.POST.get('code'))
                if state['status']:
                    node_id = state['user'].get('id')
                    try:
                        user = User.objects.get(last_name='google:' + str(node_id))
                        auth.login(request, user)
                        notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
                        return JsonResponse({
                            'status': 'success',
                            'username': user.username,
                            'notify_count': notify.count()
                        }, json_dumps_params={'ensure_ascii': True})
                    except:
                        pass
                    
                    counter = 0
                    username = state['user'].get('email').split('@')[0]
                    has_name = User.objects.filter(username=username)
                    while len(has_name) > 0:
                        has_name = User.objects.filter(username=username + str(counter))
                        counter += 1
                    
                    username = username + str('' if counter == 0 else counter)
                    new_user = User(username=username)
                    new_user.first_name = state['user'].get('name')
                    new_user.last_name = 'google:' + str(node_id)
                    new_user.email = state['user'].get('email')
                    new_user.is_active = True
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = fn.get_image(state['user'].get('picture'))
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.save()

                    config = Config(user=new_user)
                    config.save()
                    return JsonResponse({
                        'status': 'success',
                        'username': username,
                        'notify_count': 1
                    }, json_dumps_params={'ensure_ascii': True})
                else:
                    return JsonResponse({
                        'status': 'failure',
                        'message': '요청중 에러 발생'
                    }, json_dumps_params={'ensure_ascii': True})

def logout(request):
    if request.method == 'POST':
        if request.user.is_active:
            auth.logout(request)
            return JsonResponse({
                'status': 'success'
            }, json_dumps_params={'ensure_ascii': True})
        return JsonResponse({
            'status': 'failure'
        }, json_dumps_params={'ensure_ascii': True})

def signup(request):
    pass

def tags(request, tag=None):
    if not tag:
        if request.method == 'GET':
            cache_key = 'main_page_topics'
            tags = cache.get(cache_key)
            if not tags:
                tags = sorted(fn.get_clean_all_tags(desc=True), key=lambda instance:instance['count'], reverse=True)
                cache_time = 3600
                cache.set(cache_key, tags, cache_time)
            page = request.GET.get('page', 1)
            paginator = Paginator(tags, (3 * 2) * 15)
            fn.page_check(page, paginator)
            tags = paginator.get_page(page)
            return JsonResponse({
                'tags': list(map(lambda tag: {
                    'name': tag['name'],
                    'count': tag['count'],
                    'description': tag['desc']
                }, tags)),
                'last_page': tags.paginator.num_pages
            }, json_dumps_params={'ensure_ascii': True})
    
    if tag:
        if request.method == 'GET':
            posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False, tag__iregex=r'\b%s\b' % tag).order_by('-created_date')
            if len(posts) == 0:
                raise Http404()
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 21)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            desc_object = dict()
            try:
                article = Post.objects.get(url=tag, hide=False)
                desc_object = {
                    'url': article.url,
                    'author': article.author.username,
                    'description': article.description(80)
                }
            except:
                pass
            
            return JsonResponse({
                'tag': tag,
                'desc': desc_object,
                'last_page': posts.paginator.num_pages,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'read_time': post.read_time(),
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                }, posts))
            }, json_dumps_params={'ensure_ascii': True})
        
    raise Http404

def posts(request, sort):
    if request.method == 'GET':
        posts = fn.get_posts(sort)
        page = request.GET.get('page', 1)
        paginator = Paginator(posts, 21)
        fn.page_check(page, paginator)
        posts = paginator.get_page(page)
        return JsonResponse({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': post.get_thumbnail(),
                'read_time': post.read_time(),
                'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                'author_image': post.author.profile.get_thumbnail(),
                'author': post.author.username,
            }, posts)),
            'last_page': posts.paginator.num_pages
        }, json_dumps_params={'ensure_ascii': True})
    

def user_posts(request, username, url=None):
    if not url:
        if request.method == 'GET':
            posts = Post.objects.filter(created_date__lte=timezone.now(), author__username=username, hide=False)
            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tag__iregex=r'\b%s\b' % tag)
            posts = posts.order_by('-created_date')
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 10)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            return JsonResponse({
                'items': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'read_time': post.read_time(),
                    'description': post.description(),
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages
            }, json_dumps_params={'ensure_ascii': True})
        
        if request.method == 'POST':
            post = Post()
            post.title = request.POST.get('title', '')
            post.author = request.user
            post.text_md = request.POST.get('text_md', '')
            post.text_html = request.POST.get('text_html', '')

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
                return JsonResponse({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'series': post.series.url if post.series else None,
                    'text_md': post.text_md,
                    'tag': post.tag,
                    'hide': 'true' if post.hide else 'false'
                })

            if request.GET.get('mode') == 'view':
                if post.hide and request.user != post.author:
                    raise Http404
                
                comments = Comment.objects.filter(post=post).order_by('created_date')
                return JsonResponse({
                    'url': post.url,
                    'title': post.title,
                    'image': post.get_thumbnail(),
                    'description': post.description(),
                    'read_time': post.read_time(),
                    'series': post.series.url if post.series else None,
                    'created_date': post.created_date.strftime('%Y-%m-%d %H:%M'),
                    'updated_date': post.updated_date.strftime('%Y-%m-%d %H:%M'),
                    'author_image': post.author.profile.get_thumbnail(),
                    'author': post.author.username,
                    'text_html': post.text_html,
                    'total_likes': post.total_likes(),
                    'tag': post.tag,
                    'is_liked': 'true' if post.likes.filter(id=request.user.id).exists() else 'false',
                    'comments': list(map(lambda comment: {
                        'pk': comment.pk if request.user == comment.author else 0,
                        'author_image': comment.author.profile.get_thumbnail(),
                        'author': comment.author.username,
                        'text_html': comment.text_html,
                        'time_since': timesince(comment.created_date),
                        'is_edited': 'true' if comment.edited else 'false'
                    }, comments))
                })

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if request.GET.get('like', ''):
            if not request.user.is_active:
                return HttpResponse('error:NL')
            if request.user == post.author:
                return HttpResponse('error:SU')
            user = User.objects.get(username=request.user)
            if post.likes.filter(id=user.id).exists():
                post.likes.remove(user)
            else:
                post.likes.add(user)
                pass
                # TODO: Notify Send
            return HttpResponse(str(post.total_likes()))
        if request.GET.get('hide', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            post.save()
            return HttpResponse('true' if post.hide else 'false')
        if request.GET.get('tag', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.tag = fn.get_clean_tag(put.get('tag'))
            post.save()
            return JsonResponse({'tag': post.tag}, json_dumps_params={'ensure_ascii': True})
        if request.GET.get('series', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.series = None
            post.save()
            return HttpResponse('DONE')
        if request.GET.get('edit', ''):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.title = put.get('title', '')
            post.text_md = put.get('text_md', '')
            post.text_html = put.get('text_html', '')

            try:
                series_url = put.get('series', '')
                if series_url:
                    series = Series.objects.get(owner=request.user, url=series_url)
                    post.series = series
            except:
                pass

            post.tag = fn.get_clean_tag(put.get('tag', ''))
            post.save()
            return HttpResponse('DONE')
    
    if request.method == 'DELETE':
        fn.compere_user(request.user, post.author, give_404_if='different')
        post.delete()
        return HttpResponse('DONE')
    
    raise Http404

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
            })
        return JsonResponse(data, json_dumps_params={'ensure_ascii': True})

    if request.method == 'POST':
        viewonly = request.POST.get('viewonly', '')
        if viewonly:
            fn.view_up(post, request)
        
        referer = request.POST.get('referer', '')
        if referer:
            fn.create_referer(post, referer)
        
        return HttpResponse(randstr(25))

def user_series(request, username, url=None):
    if not url:
        if request.method == 'GET':
            series = Series.objects.filter(owner__username=username, hide=False).order_by('-created_date')
            page = request.GET.get('page', 1)
            paginator = Paginator(series, 10)
            fn.page_check(page, paginator)
            series = paginator.get_page(page)
            return JsonResponse({
                'series': list(map(lambda item: {
                    'url': item.url,
                    'name': item.name,
                    'image': item.thumbnail(),
                    'created_date': item.created_date.strftime('%Y년 %m월 %d일'),
                    'owner': item.owner.username,
                }, series)),
                'last_page': series.paginator.num_pages
            }, json_dumps_params={'ensure_ascii': True})
        
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
                return JsonResponse({
                    'title': series.name,
                    'url': series.url,
                    'image': series.thumbnail(),
                    'owner': user.username,
                    'owner_image': user.profile.get_thumbnail(),
                    'description': series.text_md,
                    'posts': list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'description': post.description(50),
                        'created_date': post.created_date.strftime('%Y년 %m월 %d일')
                    }, posts))
                }, json_dumps_params={'ensure_ascii': True})
        
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

def user_setting(request, username, item):
    user = get_object_or_404(User, username=username)
    if request.user != user:
        return HttpResponse('error:DU')
    
    if request.method == 'GET':
        if item == 'notify':
            notify = Notify.objects.filter(user=user, is_read=False).order_by('-created_date')
            return JsonResponse({
                'notify': list(map(lambda item: {
                    'pk': item.pk,
                    'url': item.url,
                    'content': item.infomation,
                    'created_date': timesince(item.created_date)
                }, notify)),
                'is_telegram_sync': 'true' if user.config.telegram_id else 'false'
            }, json_dumps_params={'ensure_ascii': True})
        
        if item == 'account':
            return JsonResponse({
                'username': user.username,
                'realname': user.first_name,
                'created_date': user.date_joined.strftime('%Y년 %m월 %d일')
            }, json_dumps_params={'ensure_ascii': True})
        
        if item == 'profile':
            profile = Profile.objects.get(user=user)
            return JsonResponse({
                'avatar': profile.get_thumbnail(),
                'bio': profile.bio,
                'homepage': profile.homepage,
                'github': profile.github,
                'twitter': profile.twitter,
                'youtube': profile.youtube,
                'facebook': profile.facebook,
                'instagram': profile.instagram
            }, json_dumps_params={'ensure_ascii': True})
        
        if item == 'posts':
            posts = Post.objects.filter(author=user).order_by('-created_date')
            return JsonResponse({
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': post.created_date.strftime('%Y-%m-%d'),
                    'updated_date': post.updated_date.strftime('%Y-%m-%d'),
                    'hide': 'true' if post.hide else 'false',
                    'total_likes': post.total_likes(),
                    'total_comments': post.total_comment(),
                    'today': post.today(),
                    'yesterday': post.yesterday(),
                    'total': post.total(),
                    'tag': post.tag
                }, posts))
            }, json_dumps_params={'ensure_ascii': True})
        
        if item == 'series':
            series = Series.objects.filter(owner=user).order_by('-created_date')
            return JsonResponse({
                'series': list(map(lambda item: {
                    'url': item.url,
                    'title': item.name,
                    'total_posts': item.total_posts()
                }, series))
            }, json_dumps_params={'ensure_ascii': True})
    
    if request.method == 'PUT':
        put = QueryDict(request.body)

        if item == 'notify':
            pk = put.get('pk')
            notify = Notify.objects.get(pk=pk)
            notify.is_read = True
            notify.save()
            return HttpResponse('DONE')
        
        if item == 'account':
            realname = put.get('realname', '')
            password = put.get('password', '')
            if realname and user.first_name != realname:
                user.first_name = realname
            if password:
                user.set_password(password)
            user.save()
            return HttpResponse('DONE')
        
        if item == 'profile':
            req_data = dict()
            items = [
                'bio',
                'homepage',
                'github',
                'twitter',
                'facebook',
                'instagram',
                'youtube'
            ]
            for item in items:
                req_data[item] = put.get(item, '')
            
            # TODO: QuerySet의 attr을 dict처럼 가져오는 방법 모색
            profile = Profile.objects.get(user=user)
            if profile.bio != req_data['bio']:
                profile.bio = req_data['bio']
            if profile.homepage != req_data['homepage']:
                profile.homepage = req_data['homepage']
            if profile.github != req_data['github']:
                profile.github = req_data['github']
            if profile.twitter != req_data['twitter']:
                profile.twitter = req_data['twitter']
            if profile.facebook != req_data['facebook']:
                profile.facebook = req_data['facebook']
            if profile.instagram != req_data['instagram']:
                profile.instagram = req_data['instagram']
            if profile.youtube != req_data['youtube']:
                profile.youtube = req_data['youtube']
            profile.save()
            return HttpResponse('DONE')
    
    raise Http404

def temp_posts(request):
    if request.method == 'GET':
        token = request.GET.get('token')
        if token:
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            return JsonResponse(temp_posts.to_dict(), json_dumps_params={'ensure_ascii': True})

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
            return JsonResponse(data, json_dumps_params={'ensure_ascii': True})

    if request.method == 'POST':
        temps = TempPosts.objects.filter(author=request.user).count()
        if temps >= 5:
            return HttpResponse('Error:EG')
        
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
        temp_posts.remove()

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
                text_md=body.get('comment'),
                text_html=body.get('comment_md')
            )
            comment.save()
            fn.add_exp(request.user, 1)
            
            if not comment.author == post.author:
                send_notify_content = '\''+ post.title +'\'글에 @'+ comment.author.username +'님이 댓글을 남겼습니다.'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
            
            regex = re.compile(r'\`\@([a-zA-Z0-9]*)\`\s?')
            if regex.search(comment.text_md):
                tag_user_list = regex.findall(comment.text_md)
                tag_user_list = set(tag_user_list)

                commentors = Comment.objects.filter(post=post).values_list('author__username')
                commentors = set(map(lambda instance: instance[0], commentors))

                for tag_user in tag_user_list:
                    if tag_user in commentors:
                        _user = User.objects.get(username=tag_user)
                        if not _user == request.user:
                            send_notify_content = '\''+ post.title +'\'글에서 @'+ request.user.username +'님이 회원님을 태그했습니다.'
                            fn.create_notify(user=_user, url=post.get_absolute_url(), infomation=send_notify_content)
            
            return JsonResponse({
                'status': 'success',
                'element': {
                    'pk': comment.pk,
                    'author_image': comment.author.profile.get_thumbnail(),
                    'author': comment.author.username,
                    'text_html': comment.text_html,
                    'time_since': timesince(comment.created_date),
                    'edited': 'true 'if comment.edited else 'false'
                }
            }, json_dumps_params={'ensure_ascii': True})
    
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
                user = User.objects.get(username=request.user)
                if comment.likes.filter(id=user.id).exists():
                    comment.likes.remove(user)
                    comment.save()
                else:
                    comment.likes.add(user)
                    comment.save()
                    send_notify_content = '\''+ comment.post.title +'\'글에 작성한 회원님의 댓글을 누군가 추천했습니다.'
                    fn.create_notify(user=comment.author, url=comment.post.get_absolute_url(), infomation=send_notify_content)
                return HttpResponse(str(comment.total_likes()))
            
            if put.get('comment'):
                if not request.user == comment.author:
                    return HttpResponse('error:DU')
                comment.text_md = put.get('comment')
                comment.text_html = put.get('comment_md')
                comment.edited = True
                comment.save()
                return HttpResponse('DONE')
        
        if request.method == 'DELETE':
            if not request.user == comment.author:
                return HttpResponse('error:DU')
            comment.delete()
            return HttpResponse('DONE')
    
    raise Http404

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
                        key = timestamp(element.created_date, kind='grass')[:10]
                        if key in heatmap:
                            heatmap[key] += 1
                        else:
                            heatmap[key] = 1
                    data[include] = heatmap

                elif include == 'tags':
                    data[include] = fn.get_user_topics(user=user, include='posts')
                
                elif include == 'view':
                    today_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
                    yesterday_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=1)))
                    data[include] = {
                        'today': fn.get_view_count(user, today_date),
                        'yesterday': fn.get_view_count(user, yesterday_date),
                        'total': fn.get_view_count(user)
                    }
                
                elif include == 'most':
                    data[include] = list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'image': post.get_thumbnail(),
                        'read_time': post.read_time(),
                        'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
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
                        data[include].append(active_dict)
                
                elif include == 'about':
                    data[include] = user_profile.about_html
                
            return JsonResponse(data, json_dumps_params={'ensure_ascii': True})

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
            return JsonResponse(data, json_dumps_params={'ensure_ascii': True})

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
    
    raise Http404

@csrf_exempt
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

@csrf_exempt
def telegram(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            print(request.body.decode("utf-8"))
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            try:
                req = json.loads(request.body.decode("utf-8"))
                req_userid = req['message']['from']['id']
                req_token = req['message']['text']
                check = Config.objects.get(telegram_token=req_token)
                if check:
                    check.telegram_token = ''
                    check.telegram_id = req_userid
                    check.save()
                    bot.send_message_async(req_userid, '정상적으로 연동되었습니다.')
            except:
                message = '블렉스 다양한 정보를 살펴보세요!\n\n' + settings.SITE_URL + '/notion'
                bot.send_message_async(req_userid, message)
            return HttpResponse('None')
    
    if parameter == 'makeToken':
        if request.method == 'POST':
            token = randstr(6)
            has_token = Config.objects.filter(telegram_token=token)
            while len(has_token) > 0:
                token = randstr(6)
                has_token = Config.objects.filter(telegram_token=token)

            if hasattr(request.user, 'config'):
                config = request.user.config
                config.telegram_token = token
                config.save()
                return HttpResponse(token)
            else:
                config = Config(user=request.user)
                config.telegram_token = token
                config.save()
                return HttpResponse(token)
    
    if parameter == 'unsync':
        if request.method == 'POST':
            config = request.user.config
            if not config.telegram_id == '':
                config.telegram_id = ''
                config.save()
                return HttpResponse('DONE')
            else:
                return HttpResponse('error:AU')
    
    raise Http404