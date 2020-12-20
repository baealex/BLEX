import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *

bot_histroys = History.objects.filter(category__contains='bot')

for bot_histroy in bot_histroys:
    time.sleep(1)

    temp_categry = bot_histroy.category
    bot_types = [
        'google',
        'bing',
        'commoncrawl',
        'petal',
        'notion',
        'naver',
        'kakao',
        'slack',
        'telegram',
        'twitter',
        'semrush',
        'mj12',
        'seznam',
        'blex',
        'yandex',
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
    for bot_type in bot_types:
        if bot_type in bot_histroy.agent.lower():
            bot_histroy.category = bot_type + '-bot'
            break
    
    if temp_categry != bot_histroy.category:
        print(bot_histroy.agent)
        print('==> ' + bot_histroy.category)
        bot_histroy.save()