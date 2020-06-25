import io
import os
import base64
import hashlib
import requests

from itertools import chain
from django.http import Http404
from django.utils import timezone
from django.db.models import Count, Q
from django.utils.text import slugify
from django.utils.html import strip_tags
from django.core.cache import cache
from django.conf import settings

from .models import *
from . import telegram

def view_count(type, element, request):
    if element.author == request.user:
        return
    
    history = None
    user_agent = request.META['HTTP_USER_AGENT']
    try:
        history = History.objects.get(key=get_encrypt_ip(request))
        if not history.agent == user_agent[:200]:
            history.agent = user_agent[:200]
            if 'bot' in user_agent.lower() or 'facebookexternalhit' in user_agent.lower():
                history.category = 'temp-bot'
            else:
                if not history.category == '' and not '(u)' in history.category:
                    history.category += '(u)'
            history.save()
            history.refresh_from_db()
    except:
        history = History(key=get_encrypt_ip(request))
        history.agent = user_agent[:200]
        if 'bot' in user_agent.lower() or 'facebookexternalhit' in user_agent.lower():
            history.category = 'temp-bot'
        history.save()
        history.refresh_from_db()
    
    if not 'bot' in history.category:
        today = timezone.make_aware(datetime.datetime.now())
        today_analytics = None
        try:
            if type == 'posts':
                today_analytics = PostAnalytics.objects.get(date=today, posts=element)
            elif type == 'thread':
                today_analytics = ThreadAnalytics.objects.get(date=today, thread=element)
        except:
            if type == 'posts':
                today_analytics = PostAnalytics(posts=element)
            elif type == 'thread':
                today_analytics = ThreadAnalytics(thread=element)
            today_analytics.save()
            today_analytics.refresh_from_db()
        
        if not today_analytics.table.filter(id=history.id).exists():
            today_analytics.table.add(history)
            if 'Referer' in request.headers:
                now = datetime.datetime.now().strftime('%H:%M')
                today_analytics.referer += now + '^' + request.headers['Referer'] + '|'
            elif 'kakaotalk' in user_agent.lower():
                now = datetime.datetime.now().strftime('%H:%M')
                today_analytics.referer += now + '^' + 'app://com.kakaocorp.talk' + '|'
            today_analytics.save()

def get_posts(sort, user=None):
    if sort == 'trendy':
        cache_key = 'sort_' + sort
        if user:
            cache_key += '_' + user.username
        elements = cache.get(cache_key)
        if not elements:
            cache_time = 7200
            posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
            threads = Thread.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
            if user:
                posts = posts.filter(author=user)
                threads = threads.filter(author=user)
            elements = sorted(chain(posts, threads), key=lambda instance: instance.trendy(), reverse=True)
            cache.set(cache_key, elements, cache_time)
        return elements
    if sort == 'newest':
        posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        threads = Thread.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        if user:
            posts = posts.filter(author=user)
            threads = threads.filter(author=user)
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)
    if sort == 'notice':
        posts = Post.objects.filter(notice=True)
        threads = Thread.objects.filter(notice=True)
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)

def get_view_count(user, date=None):
    posts = PostAnalytics.objects.annotate(table_count=Count('table')).filter(posts__author=user)
    threads = ThreadAnalytics.objects.annotate(table_count=Count('table')).filter(thread__author=user)
    if date:
        posts = posts.filter(date=date)
        threads = threads.filter(date=date)
    posts = posts.aggregate(Sum('table_count'))
    threads = threads.aggregate(Sum('table_count'))

    count = 0
    if posts['table_count__sum']:
        count += posts['table_count__sum']
    if threads['table_count__sum']:
        count += threads['table_count__sum']
    return count

def get_clean_all_tags(user=None, count=True, desc=False):
    posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False)
    thread = Thread.objects.filter(created_date__lte=timezone.now(), hide=False)
    if user:
        posts = posts.filter(author=user)
        thread = thread.filter(author=user)
    
    tagslist = list(posts.values_list('tag', flat=True)) + (
        list(thread.values_list('tag', flat=True)))
    
    all_tags = set()
    for tags in set(tagslist):
        all_tags.update([x for x in tags.split(',') if not x.strip() == ''])

    if count:
        all_tags_dict = list()
        for tag in all_tags:
            tag_dict = {
                'name': tag,
                'count': 0
            }
            for tags in tagslist:
                if ',' + tag + ',' in ',' + tags + ',':
                    tag_dict['count'] += 1
            all_tags_dict.append(tag_dict)
        
        if not desc:
            return all_tags_dict
    
    if desc:
        descriptions = dict()
        stories = Story.objects.filter(thread__url='desc')
        for story in stories:
            descriptions[story.url] = {
                'desc': strip_tags(story.text_html)[:50],
                'link': story.get_absolute_url()
            }

        for i in range(len(all_tags_dict)):
            if all_tags_dict[i]['name'] in descriptions:
                all_tags_dict[i]['desc'] = descriptions[all_tags_dict[i]['name']]['desc']
                all_tags_dict[i]['desc_link'] = descriptions[all_tags_dict[i]['name']]['link']
            
        return all_tags_dict

    return all_tags

def get_clean_tag(tag):
    clean_tag = slugify(tag.replace(',', '-').replace('_', '-'), allow_unicode=True).split('-')
    return ','.join(list(set(clean_tag)))

def get_encrypt_ip(request):
    ip_addr = request.META.get('REMOTE_ADDR')
    if not ip_addr:
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR')
    return base64.b64encode(hashlib.sha256(ip_addr.encode()).digest()).decode()

def get_exp(user):
    if hasattr(user, 'profile'):
        if user.profile.exp >= 0 and user.profile.exp < 15:
            return 'empty'
        elif user.profile.exp >= 15 and user.profile.exp < 40:
            return 'quarter'
        elif user.profile.exp >= 40 and user.profile.exp < 65:
            return 'half'
        elif user.profile.exp >= 65 and user.profile.exp < 85:
            return 'three-quarters'
        elif user.profile.exp >= 85:
            return 'full'
    else:
        return 'empty'

def get_grade(user):
    select_grade = 'blogger'
    if hasattr(user, 'profile'):
        if user.profile.grade:
            select_grade = str(user.profile.grade)
    return select_grade

def get_user_topics(user):
    cache_key = user.username + '_topics'
    tags = cache.get(cache_key)
    if not tags:
        tags = sorted(get_clean_all_tags(user), key=lambda instance:instance['count'], reverse=True)
        cache_time = 120
        cache.set(cache_key, tags, cache_time)
    return tags

def get_image(url):
    image = requests.get(url, stream=True)
    if not image.status_code == 200:
        return None
    binary_image = image.content
    temp_image = io.BytesIO()
    temp_image.write(binary_image)
    temp_image.seek(0)
    return temp_image

def night_mode(request):
    update_dict = {
        'night_changer': True,
    }
    if request.COOKIES.get('nightmode') is not None:
        update_dict['night_mode'] = True
    else:
        update_dict['night_mode'] = False
    update_dict['white_nav'] = not update_dict['night_mode']
    return update_dict

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

def auth_captcha(response):
    data = {
        'response': response,
        'secret': settings.GOOGLE_RECAPTCHA_SECRET_KEY
    }
    response = requests.post('https://www.google.com/recaptcha/api/siteverify', data=data)
    if response.json().get('success'):
        return True
    return False

def add_exp(user, num):
    if hasattr(user, 'profile'):
        user.profile.exp += num
        if user.profile.exp > 100:
            user.profile.exp = 100
        user.profile.save()
    else:
        new_profile = Profile(user=user, exp=num)
        new_profile.save()

def make_path(upload_path, dir_list):
    for dir_name in dir_list:
        upload_path += ('/' + dir_name)
        if not os.path.exists(upload_path):
            os.makedirs(upload_path)
    return upload_path

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
    new_notify = Notify(user=user, url=url, infomation=infomation)
    new_notify.save()
    if hasattr(user, 'config'):
        telegram_id = user.config.telegram_id
        if not telegram_id == '':
            bot = telegram.TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            bot.send_messages_async(telegram_id, [
                settings.SITE_URL + '/notify:' + str(new_notify.pk),
                infomation
            ])