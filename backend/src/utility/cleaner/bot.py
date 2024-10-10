import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import *
from board.modules.analytics import NONE_HUMANS, get_bot_name

if __name__ == '__main__':
    humans = Device.objects.exclude(category__contains='bot')

    for human in humans:
        for none_human in NONE_HUMANS:
            if none_human in human.agent.lower():
                print(f'new bot ==> {human.agent}')
                human.category = 'temp-bot'
                human.save()
                time.sleep(0.1)
    
    bots = Device.objects.filter(category__contains='bot')

    for bot in bots:
        prev_category = bot.category
        next_category = get_bot_name(bot.category)
        
        if prev_category != next_category:
            print(f'{prev_category} ==> {next_category}')
            bot.category = next_category
            bot.save()
            time.sleep(0.1)
