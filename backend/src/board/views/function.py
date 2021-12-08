import os
import requests

from django.http import Http404
from django.utils import timezone
from django.db.models import Count, F, Q
from django.utils.text import slugify
from django.core.cache import cache
from django.conf import settings

from board.models import *
from modules.hash import get_sha256
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot

def auth_google(code):
    data = {
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.SITE_URL + '/login/callback/google',
        'grant_type': 'authorization_code',
    }
    response = requests.post(
        'https://accounts.google.com/o/oauth2/token', data=data
    )
    if response.status_code == 200:
        params = {
            'access_token': response.json().get('access_token')
        }
        response = requests.get(
            'https://www.googleapis.com/oauth2/v1/userinfo', params=params
        )
        try:
            return {'status': True, 'user': response.json()}
        except:
            pass
    return {'status': False}

def auth_github(code):
    data = {
        'code': code,
        'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
        'client_secret': settings.GITHUB_OAUTH_CLIENT_SECRET
    }
    headers = {'Accept': 'application/json'}
    response = requests.post(
        'https://github.com/login/oauth/access_token', headers=headers, data=data
    )
    if response.status_code == 200:
        access_token = response.json().get('access_token')
        headers = {'Authorization': 'token ' + str(access_token)}
        response = requests.get(
            'https://api.github.com/user', headers=headers
        )
        try:
            return {'status': True, 'user': response.json()}
        except:
            pass
    return {'status': False}

def auth_hcaptcha(response):
    data = {
        'response': response,
        'secret': settings.HCAPTCHA_SECRET_KEY
    }
    response = requests.post('https://hcaptcha.com/siteverify', data=data)
    if response.json().get('success'):
        return True
    return False

def compere_user(req, res, give_404_if='none'):
    if give_404_if == 'same':
        if req == res:
            raise Http404
    else:
        if not req == res:
            raise Http404

def page_check(page, paginator):
    try:
        page = int(page)
    except:
        raise Http404
    if not page or int(page) > paginator.num_pages or int(page) < 1:
        raise Http404

def create_notify(user, url, infomation):
    hash_key = get_sha256(user.username + url + infomation)
    if Notify.objects.filter(key=hash_key).exists():
        return
    
    new_notify = Notify(user=user, url=url, infomation=infomation, key=hash_key)
    new_notify.save()
    if hasattr(user, 'telegramsync'):
        tid = user.telegramsync.tid
        if not tid == '':
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            sub_task_manager.append(lambda: bot.send_messages(tid, [
                settings.SITE_URL + str(url),
                infomation
            ]))