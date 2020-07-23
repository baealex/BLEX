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

def search_google(value, page):
    req_uri = 'https://www.googleapis.com/customsearch/v1/siterestrict'
    req_uri += '?key=' + settings.GOOGLE_SEARCH_API_KEY
    req_uri += '&cx=' + settings.GOOGLE_SEARCH_ID
    req_uri += '&q=' + str(value)
    page = int(page)
    if page > 1:
        req_uri += '&start=' + str(page*10 + 1)
    
    response = requests.get(req_uri)
    if 'error' in response.json():
        return { 'code': 429 }
    items = response.json().get('items')
    queries = response.json().get('queries')

    result = {
        'items': list(),
    }
    if not 'totalResults' in queries['request'][0]:
        return { 'code': 404, 'total': 0 }
    result['total'] = queries['request'][0]['totalResults']
    result['number'] = page
    result['paginator'] = dict()
    result['paginator']['num_pages'] = int(int(queries['request'][0]['totalResults']) / 10)
    result['paginator']['page_range'] = range(1, result['paginator']['num_pages'])

    if 'nextPage' in queries:
        result['has_next'] = True
        result['next_page_number'] = page + 1
    if 'previousPage' in queries:
        result['has_previous'] = True
        result['previous_page_number'] = page - 1

    for item in items:
        result['items'].append({
            'title': item['title'],
            'description': item['snippet'],
            'link': item['link'],
        })
    return result

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
        today = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
        today_analytics = None
        try:
            today_analytics = PostAnalytics.objects.get(created_date=today, posts=element)
        except:
            today_analytics = PostAnalytics(posts=element)
            today_analytics.save()
            today_analytics.refresh_from_db()
        
        if not today_analytics.table.filter(id=history.id).exists():
            today_analytics.table.add(history)
            today_analytics.save()
        
        if 'Referer' in request.headers:
            referer_from = None
            referer = request.headers['Referer'][:500]
            try:
                referer_from = RefererFrom.objects.get(location=referer)
            except:
                referer_from = RefererFrom(location=referer)
                referer_from.save()
                referer_from.refresh_from_db()
            Referer(
                posts = today_analytics,
                referer_from = referer_from
            ).save()

def get_posts(sort, user=None):
    if sort == 'trendy':
        cache_key = 'sort_' + sort
        if user:
            cache_key += '_' + user.username
        elements = cache.get(cache_key)
        if not elements:
            cache_time = 7200
            posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
            if user:
                posts = posts.filter(author=user)
            elements = sorted(posts, key=lambda instance: instance.trendy(), reverse=True)
            cache.set(cache_key, elements, cache_time)
        return elements
    if sort == 'newest':
        posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        if user:
            posts = posts.filter(author=user)
        return posts.order_by('-created_date')
    if sort == 'notice':
        posts = Post.objects.filter(notice=True)
        return posts.order_by('-created_date')

def get_view_count(user, date=None):
    posts = PostAnalytics.objects.annotate(table_count=Count('table')).filter(posts__author=user)
    if date:
        posts = posts.filter(created_date=date)
    posts = posts.aggregate(Sum('table_count'))

    count = 0
    if posts['table_count__sum']:
        count += posts['table_count__sum']
    return count

def get_clean_all_tags(user=None, count=True, desc=False, include='posts'):
    posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False)
    if user:
        posts = posts.filter(author=user)
    
    tagslist = []
    if 'posts' in include:
        tagslist += list(posts.values_list('tag', flat=True))
    
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
        posts = Post.objects.filter(hide=False)
        for post in posts:
            descriptions[post.url] = {
                'desc': strip_tags(post.text_html)[:80],
            }

        for i in range(len(all_tags_dict)):
            if all_tags_dict[i]['name'] in descriptions:
                all_tags_dict[i]['desc'] = descriptions[all_tags_dict[i]['name']]['desc']
            
        return all_tags_dict

    return all_tags

def get_user_topics(user, include='posts,thread'):
    cache_key = user.username + '_' + include +'_topics'
    tags = cache.get(cache_key)
    if not tags:
        tags = sorted(get_clean_all_tags(user=user, include=include), key=lambda instance:instance['count'], reverse=True)
        cache_time = 600
        cache.set(cache_key, tags, cache_time)
    return tags

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