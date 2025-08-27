import ipaddress
import re
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
    'http://www.blex.kr',
    'https://blex.kr',
    'http://blex.kr',
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
    """
    Extract the real client IP address from request headers.
    Handles proxy chains, load balancers, and CDN forwarded IPs.
    """
    
    # Priority order: most trusted sources first
    ip_headers = [
        'HTTP_CF_CONNECTING_IP',      # Cloudflare
        'HTTP_X_REAL_IP',             # Nginx proxy_pass
        'HTTP_X_FORWARDED_FOR',       # Standard proxy header
        'HTTP_X_FORWARDED',           # Less common
        'HTTP_X_CLUSTER_CLIENT_IP',   # Cluster/load balancer
        'HTTP_FORWARDED_FOR',         # Legacy
        'HTTP_FORWARDED',             # RFC 7239
        'REMOTE_ADDR',                # Direct connection
    ]
    
    def is_valid_ip(ip_str):
        """Validate if string is a valid IP address"""
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
            # Exclude private/local addresses for forwarded headers
            if ip_str != request.META.get('REMOTE_ADDR', ''):
                return not (ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_reserved)
            return True
        except (ValueError, ipaddress.AddressValueError):
            return False
    
    def clean_ip(ip_str):
        """Clean and extract IP from header value"""
        if not ip_str:
            return None
            
        # Remove port numbers (IPv4:port or [IPv6]:port)
        ip_str = re.sub(r':(\d+)$', '', ip_str)
        ip_str = re.sub(r'^\[(.+)\]$', r'\1', ip_str)  # Remove IPv6 brackets
        
        # Handle forwarded headers with multiple IPs
        if ',' in ip_str:
            # Take the leftmost (original client) IP
            ips = [ip.strip() for ip in ip_str.split(',')]
            for ip in ips:
                if is_valid_ip(ip):
                    return ip.strip()
        else:
            ip_str = ip_str.strip()
            if is_valid_ip(ip_str):
                return ip_str
        
        return None
    
    # Try each header in priority order
    for header in ip_headers:
        header_value = request.META.get(header, '')
        if header_value:
            ip = clean_ip(header_value)
            if ip:
                return ip
    
    # Fallback: return None if no valid IP found
    return None


def view_count(post: Post, request, ip, user_agent, referrer):
    # Skip if author viewing own post
    if request.user.is_authenticated and post.author == request.user:
        return

    if post.config.hide or not post.is_published():
        return

    if ip and user_agent:
        create_viewer(post, ip, user_agent)

    if referrer:
        create_referer(post, referrer)


def create_referer(post: Post, referer: str):
    if not has_valid_referer(referer):
        return

    today = timezone.now().date()
    today_analytics, _ = PostAnalytics.objects.get_or_create(
        created_date=today,
        post=post
    )

    # Normalize referer URL
    referer = referer[:500]
    if 'google' in referer and 'url' in referer:
        referer = 'https://www.google.com/'

    referer_from, _ = RefererFrom.objects.get_or_create(
        location=referer
    )

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


def create_viewer(post, ip, user_agent):
    device = create_device(ip, user_agent)

    if 'bot' not in device.category:
        today = timezone.now().date()
        today_analytics, _ = PostAnalytics.objects.get_or_create(
            created_date=today, 
            post=post
        )

        # Use add() which automatically handles duplicates
        today_analytics.devices.add(device)


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
