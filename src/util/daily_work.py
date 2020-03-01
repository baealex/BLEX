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
    if not config.telegram_token == '':
        config.telegram_token = ''
        config.save()
    if not config.telegram_id == '':
        username = config.user.username
        send_user_names += (username,)
        send_user_lists[username] = {
            'id': config.telegram_id,
            'data': {
                'yesterday_total': 0,
                'today_total': 0,
                'top': None,
                'top_count': 0,
            }
        }

posts = Post.objects.all()
thread = Thread.objects.all()

for post in posts:
    username = post.author.username
    if username in send_user_names:
        send_user_lists[username]['data']['yesterday_total'] += post.yesterday
        send_user_lists[username]['data']['today_total'] += post.today
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
    today_total = send_user_lists[username]['data']['today_total']
    yesterday_total = send_user_lists[username]['data']['yesterday_total']
    top_posts = send_user_lists[username]['data']['top']
    text = ':: \"' + username + '\" 님을 위한 오늘의 보고서 ::\n\n'
    if today_total:
        text += '— 조회수 분석 —\n'
        text += '오늘 총 조회수 : ' + str(today_total) + '\n'
        if yesterday_total:
            percentage = int((today_total/yesterday_total)*100)
            if percentage > 100:
                text += '전일 대비 : ' + str(percentage) + '%로 증가!\n'
            else:
                text += '전일 대비 : ' + str(percentage) + '%로 감소...\n'
        text += '\n'
    if top_posts:
        text += '— 가장 많이 조회된 포스트 —\n'
        text += '\"' + top_posts + '\"\n'
        text += '\n'
    emoji = ['😀', '😁', '😙', '🤗', '😏', '😥', '🥱', '😪', '😗', '😆', '🥰']
    text += '오늘 하루도 고생하셨습니다 ' + emoji[random.randint(0, len(emoji))]
    bot.send_message_async(send_user_lists[username]['id'], text)
print('ALL MESSAGE SEND!')