import os
import base64
import hashlib

from itertools import chain
from django.http import Http404
from django.utils import timezone
from django.db.models import Count, Q
from django.utils.text import slugify
from django.core.cache import cache

from .models import Post, Thread, Profile, Notify
from . import telegram, telegram_token

def get_posts(sort):
    if sort == 'trendy':
        posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('-created_date')
        threads = Thread.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('-created_date')
        return sorted(chain(posts, threads), key=lambda instance: instance.trendy(), reverse=True)
    if sort == 'newest':
        posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        threads = Thread.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)
    if sort == 'notice':
        posts = Post.objects.filter(notice=True).order_by('-created_date')
        threads = Thread.objects.filter(notice=True).order_by('-created_date')
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)

def get_clean_all_tags(user=None):
    posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False)
    thread = Thread.objects.filter(created_date__lte=timezone.now(), hide=False)
    if user == None:
        tagslist = list(posts.values_list('tag', flat=True).distinct()) + (
            list(thread.values_list('tag', flat=True).distinct()))
    else:
        tagslist = list(posts.filter(author=user).values_list('tag', flat=True).distinct()) + (
            list(thread.filter(author=user).values_list('tag', flat=True).distinct()))

    all_tags = set()
    for tags in tagslist:
        all_tags.update([x for x in tags.split(',') if not x.strip() == ''])

    all_tags_dict = list()
    for tag in all_tags:
        tag_dict = { 'name': tag }
        if user == None:
            tag_dict['count'] = len(posts.filter(tag__iregex=r'\b%s\b' % tag)) + (
                len(thread.filter(tag__iregex=r'\b%s\b' % tag)))
        else:
            tag_dict['count'] = len(posts.filter(author=user, tag__iregex=r'\b%s\b' % tag)) + (
                len(thread.filter(author=user, tag__iregex=r'\b%s\b' % tag)))
        all_tags_dict.append(tag_dict)
    return all_tags_dict

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
            bot = telegram.TelegramBot(telegram_token.BOT_TOKEN)
            bot.send_messages_async(telegram_id, [
                'https://blex.me' + url,
                infomation
            ])