import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *
from board.module.analytics import NONE_HUMANS, BOT_TYPES

if __name__ == '__main__':
    humans = History.objects.exclude(category__contains='bot')

    for human in humans:
        for none_human in NONE_HUMANS:
            if none_human in human.agent.lower():
                print(f'new bot ==> {human.agent}')
                human.category = 'temp-bot'
                human.save()
                time.sleep(0.1)
    
    bots = History.objects.filter(category__contains='bot')

    for bot in bots:
        temp_categry = bot.category
        for bot_type in BOT_TYPES:
            if bot_type in bot.agent.lower():
                bot.category = bot_type + '-bot'
                break
        
        if temp_categry != bot.category:
            print(f'{temp_categry} ==> {bot.category}')
            bot.save()
            time.sleep(0.1)