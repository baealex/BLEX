# export
from .auth import *
from .comments import *
from .posts import *
from .series import *
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
from django.utils import timezone
from django.utils.text import slugify
from django.utils.html import strip_tags
from django.utils.timesince import timesince
from PIL import Image, ImageFilter

from board.forms import *
from board.models import *
from board.module.subtask import sub_task_manager
from board.module.telegram import TelegramBot
from board.module.response import CamelizeJsonResponse
from board.views import function as fn

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