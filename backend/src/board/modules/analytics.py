from django.conf import settings
from django.utils import timezone

from board.models import Device, Post, PostAnalytics, Referer, RefererFrom
from modules.sub_task import SubTaskProcessor
from modules.scrap import page_parser
from modules.hash import get_sha256

INVALID_REFERERS = [
    settings.SITE_URL.split('//')[-1],
    'http://localhost',
    'http://127.0.0.1',
    'http://in-vm',
    'http://blex.test',
    'https://www.blex.kr',
    'https://blex.kr',
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
    'applebot',
    'bingbot',
    'google',
    'kakao',
    'naver',
    'slack',
    'telegram',
    'twitter',
    'yandex',
    'facebook',
]


def get_network_addr(request):
    ip_maps = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_X_FORWARDED_FOR',
        'REMOTE_ADDR',
    ]
    for ip_map in ip_maps:
        ip_addr = request.META.get(ip_map).split(',')[0]
        if ip_addr:
            return ip_addr
    return None


def view_count(post: Post, request, ip, user_agent, referer):
    if post.author == request.user:
        return

    if post.config.hide or not post.is_published():
        return

    if ip and user_agent:
        create_viewer(post, ip, user_agent)

    if referer:
        create_referer(post, referer)


def create_referer(post: Post, referer: str):
    if not has_valid_referer(referer):
        return

    today = timezone.now()
    today_analytics = None
    try:
        today_analytics = PostAnalytics.objects.get(
            created_date=today,
            post=post
        )
    except:
        today_analytics = PostAnalytics(post=post)
        today_analytics.save()
        today_analytics.refresh_from_db()

    referer_from = None
    referer = referer[:500]
    if 'google' in referer and 'url' in referer:
        referer = 'https://www.google.com/'

    referer_from = RefererFrom.objects.filter(location=referer)
    if referer_from.exists():
        referer_from = referer_from.first()
    else:
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
            referer_from.save()
        SubTaskProcessor.process(func)
    Referer(
        post=post,
        analytics=today_analytics,
        referer_from=referer_from
    ).save()


def has_valid_referer(referer):
    for item in INVALID_REFERERS:
        if item in referer:
            return False
    return True


def create_device(ip, user_agent):
    key = get_sha256(ip)

    device = Device.objects.filter(key=key)
    if device.exists():
        device = device.first()
        should_save = False
        if not device.ip:
            device.ip = ip
            should_save = True
        if not device.agent == user_agent[:200]:
            device.agent = user_agent[:200]
            device.category = get_bot_name(user_agent)
            should_save = True
        if should_save:
            device.save()
            device.refresh_from_db()
    else:
        device = Device(key=key)
        device.ip = ip
        device.agent = user_agent[:200]
        device.category = get_bot_name(user_agent)
        device.save()
        device.refresh_from_db()
    return device


def create_viewer(posts, ip, user_agent):
    history = create_device(ip, user_agent)

    if not 'bot' in history.category:
        today = timezone.now()
        today_analytics = None
        try:
            today_analytics = PostAnalytics.objects.get(
                created_date=today, post=posts)
        except:
            today_analytics = PostAnalytics(post=posts)
            today_analytics.save()
            today_analytics.refresh_from_db()

        if not today_analytics.devices.filter(id=history.id).exists():
            today_analytics.devices.add(history)
            today_analytics.save()


def has_bot_keyword(user_agent):
    user_agent_lower = user_agent.lower()
    for item in NONE_HUMANS:
        if item in user_agent_lower:
            return True
    return False


def get_bot_name(user_agent):
    if not has_bot_keyword(user_agent):
        return ''

    for bot_type in BOT_TYPES:
        if bot_type in user_agent.lower():
            return bot_type + '-bot'
    return 'temp-bot'
