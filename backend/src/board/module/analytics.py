import base64
import datetime
import hashlib

from django.conf import settings
from django.utils import timezone

from board.models import (
    History, PostAnalytics, Referer, RefererFrom, convert_to_localtime)
from board.module.subtask import sub_task_manager
from board.module.scrap import page_parser

UNVAILD_REFERERS = [
    settings.SITE_URL,
    'in-vm',
    'AND',
    'OR',
    'IF',
    'CASE',
    'SELECT',
    '127.0.0.1'
]

NONE_HUMANS = [
    'facebookexternalhit',
    'headless',
    'requests',
    'crawler',
    'parser',
    'embed',
    'scrap',
    'java',
    'curl',
    'wget',
    'yeti',
    'bot',
]

BOT_TYPES = [
    'amazonbot',
    'applebot',
    'bingbot',
    'bitlybot',
    'commoncrawl',
    'datagnionbot',
    'embedly',
    'google',
    'petal',
    'notion',
    'naver',
    'neeva',
    'kakao',
    'slack',
    'twitter',
    'telegram',
    'semrush',
    'mj12',
    'seznam',
    'blex',
    'yandex',
    'zoominfo',
    'dot',
    'cocolyze',
    'bnf',
    'ads',
    'linkdex',
    'similartech',
    'coccoc',
    'ahrefs',
    'baidu',
    'facebook'
]

def get_ip(request):
    ip_addr = request.META.get('REMOTE_ADDR')
    if not ip_addr:
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR')
    return ip_addr

def get_hash_key(data):
    return base64.b64encode(hashlib.sha256(data).digest()).decode()

def view_count(posts, request, ip, user_agent, referer):
    if posts.author == request.user:
        return
    
    if ip and user_agent:
        create_viewer(posts, ip, user_agent)
        
    if referer:
        create_referer(posts, referer)

def create_referer(posts, referer):
    if not has_vaild_referer(referer):
        return
    
    today = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
    today_analytics = None
    try:
        today_analytics = PostAnalytics.objects.get(created_date=today, posts=posts)
    except:
        today_analytics = PostAnalytics(posts=posts)
        today_analytics.save()
        today_analytics.refresh_from_db()

    referer_from = None
    referer = referer[:500]
    if 'google' in referer and 'url' in referer:
        referer = 'https://www.google.com/'
    
    try:
        referer_from = RefererFrom.objects.get(location=referer)
    except:
        referer_from = RefererFrom(location=referer)
        referer_from.save()
        referer_from.refresh_from_db()
    if referer_from.should_update():
        def _lambda():
            data = page_parser(referer)
            if data['title']:
                referer_from.title = data['title']
            if data['image']:
                referer_from.image = data['image']
            if data['description']:
                referer_from.description = data['description']
            referer_from.update()
        sub_task_manager.append_task(_lambda)
    Referer(
        posts = today_analytics,
        referer_from = referer_from
    ).save()

def has_vaild_referer(referer):
    for item in UNVAILD_REFERERS:
        if item in referer:
            return False
    return True

def create_viewer(posts, ip, user_agent):
    history = None
    print(user_agent)
    key = get_hash_key((ip).encode())
    try:
        history = History.objects.get(key=key)
        will_save = False
        if not history.ip:
            history.ip = ip
            will_save = True
        if not history.agent == user_agent[:200]:
            history.agent = user_agent[:200]
            history.category = bot_check(user_agent)
            will_save = True
        if will_save:
            history.save()
            history.refresh_from_db()
    except:
        history = History(key=key)
        history.ip = ip
        history.agent = user_agent[:200]
        history.category = bot_check(user_agent)
        history.save()
        history.refresh_from_db()
    
    if not 'bot' in history.category:
        today = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
        today_analytics = None
        try:
            today_analytics = PostAnalytics.objects.get(created_date=today, posts=posts)
        except:
            today_analytics = PostAnalytics(posts=posts)
            today_analytics.save()
            today_analytics.refresh_from_db()
        
        if not today_analytics.table.filter(id=history.id).exists():
            today_analytics.table.add(history)
            today_analytics.save()

def has_bot_keyword(user_agent):
    user_agent_lower = user_agent.lower()
    for item in NONE_HUMANS:
        if item in user_agent_lower:
            return True
    return False

def bot_check(user_agent):
    if not has_bot_keyword(user_agent):
        return ''
    
    for bot_type in BOT_TYPES:
        if bot_type in user_agent.lower():
            return bot_type + '-bot'
    return 'temp-bot'