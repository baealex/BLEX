import datetime

from django.conf import settings
from django.utils import timezone

from board.models import (
    History, PostAnalytics, Referer, RefererFrom, convert_to_localtime)
from modules.subtask import sub_task_manager
from modules.scrap import page_parser
from modules.hash import get_sha256

UNVAILD_REFERERS = [
    settings.SITE_URL.split('//')[-1],
    'http://localhost',
    'http://127.0.0.1',
    'http://in-vm',
    'AND',
    'OR',
    'IF',
    'CASE',
    'SELECT',
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
    'ahrefs',
    'applebot',
    'bingbot',
    'coccoc',
    'commoncrawl',
    'dataforseo',
    'google',
    'kakao',
    'mail.ru_bot',
    'mj12',
    'naver',
    'petal',
    'semrush',
    'seznam',
    'slack',
    'telegram',
    'twitter',
    'yandex',
    'zoominfo',
    'facebook',
]

def get_network_addr(request):
    ip_addr = request.META.get('REMOTE_ADDR')
    if not ip_addr:
        ip_addr = request.META.get('HTTP_X_FORWARDED_FOR')
    return ip_addr

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
    
    today = timezone.now()
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
        def func():
            data = page_parser(referer)
            if data['title']:
                referer_from.title = data['title']
            if data['image']:
                referer_from.image = data['image']
            if data['description']:
                referer_from.description = data['description']
            referer_from.update()
        sub_task_manager.append(func)
    Referer(
        posts = today_analytics,
        referer_from = referer_from
    ).save()

def has_vaild_referer(referer):
    for item in UNVAILD_REFERERS:
        if item in referer:
            return False
    return True

def create_history(ip, user_agent):
    key = get_sha256(ip)
    try:
        history = History.objects.get(key=key)
        should_save = False
        if not history.ip:
            history.ip = ip
            should_save = True
        if not history.agent == user_agent[:200]:
            history.agent = user_agent[:200]
            history.category = bot_check(user_agent)
            should_save = True
        if should_save:
            history.save()
            history.refresh_from_db()
    except:
        history = History(key=key)
        history.ip = ip
        history.agent = user_agent[:200]
        history.category = bot_check(user_agent)
        history.save()
        history.refresh_from_db()
    return history

def create_viewer(posts, ip, user_agent):
    history = create_history(ip, user_agent)
    
    if not 'bot' in history.category:
        today = timezone.now()
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