import os
import sys
import django

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Config

send_user_names = tuple()
send_user_lists = dict()
for config in Config.objects.all():
    if not config.telegram_token == '':
        config.telegram_token = ''
        config.save()
print('ALL CONFIGS DONE!')

from board.models import Profile
profiles = Profile.objects.all()

for data in profiles:
    if data.exp > 0:
        data.exp -= 1
        data.save()
print('ALL PROFILES DONE!')

from board.models import PostAnalytics, ThreadAnalytics

datas = PostAnalytics.objects.all()
for data in datas:
    data.iptable = ''
    data.save()

datas = ThreadAnalytics.objects.all()
for data in datas:
    data.iptable = ''
    data.save()
print('ALL ANALITICS DONE!')