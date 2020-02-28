import os
import sys
import django

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Thread, Config

send_user_names = tuple()
send_user_lists = dict()
for config in Config.objects.all():
    if not config.telegram_id == '':
        username = config.user.username
        send_user_names += (username,)
        send_user_lists[username] = {
            'id': config.telegram_id,
            'data': {
                'total': 0,
                'top': None,
                'top_count': 0,
            }
        }

posts = Post.objects.all()
thread = Thread.objects.all()

for post in posts:
    username = post.author.username
    if username in send_user_names:
        send_user_lists[username]['data']['total'] += post.today
        if post.today > send_user_lists[username]['data']['top_count']:
            send_user_lists[username]['data']['top_count'] = post.today
            send_user_lists[username]['data']['top'] = post.title
    if post.trendy > 0:
        post.trendy -= 1
    post.trendy += int(post.today/10)
    post.total += post.yesterday
    post.yesterday = post.today
    post.today = 0
    post.save()

for data in thread:
    data.total += data.yesterday
    data.yesterday = data.today
    data.today = 0
    data.save()

print('ALL POSTS DONE!')

from board.models import Profile
profiles = Profile.objects.all()

for data in profiles:
    if data.exp > 0:
        data.exp -= 5
        data.save()
print('ALL PROFILES DONE!')

import random
from board.telegram import TelegramBot
from board.telegram_token import BOT_TOKEN
bot = TelegramBot(BOT_TOKEN)
for username in send_user_names:
    total = send_user_lists[username]['data']['total']
    top_posts = send_user_lists[username]['data']['top']
    text = ''
    if total:
        text += '오늘의 총 조회수 : ' + str(total) + '\n'
    if top_posts:
        text += '오늘 가장 많이 조회된 글 : ' + top_posts + '\n\n'
    emoji = ['😀', '😁', '😙', '🤗', '😏', '😥', '🥱', '😪', '😗', '😆', '🥰']
    text += '오늘 하루도 고생하셨습니다 ' + emoji[random.randint(0, len(emoji))]
    bot.send_message_async(send_user_lists[username]['id'], text)
print('ALL MESSAGE SEND!')