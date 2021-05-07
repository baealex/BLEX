# export
from .auth import *
from .comments import *
from .posts import *
from .series import *
from .setting import *
from .tags import *
from .users import *

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
                elif ext == 'png':
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