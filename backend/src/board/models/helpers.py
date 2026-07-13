import datetime
import hashlib

from django.template.defaultfilters import truncatewords
from django.utils.html import strip_tags

from modules.randomness import randstr


def get_user_hex(username):
    return hashlib.md5(username.encode()).hexdigest()[:2]


def cover_path(instance, filename):
    hex_prefix = get_user_hex(instance.user.username)
    return f"images/avatar/{hex_prefix}/{instance.user.username}/c{randstr(4)}.{filename.split('.')[-1]}"


def avatar_path(instance, filename):
    hex_prefix = get_user_hex(instance.user.username)
    return f"images/avatar/{hex_prefix}/{instance.user.username}/a{randstr(4)}.{filename.split('.')[-1]}"


def create_description(text):
    return truncatewords(strip_tags(text), 50)


def title_image_path(instance, filename):
    dt = datetime.datetime.now()
    path = f"images/title/{dt.year}/{dt.month}/{dt.day}/{instance.author.username}"
    name = f"{dt.hour}_{randstr(8)}.{filename.split('.')[-1]}"
    return f"{path}/{name}"
