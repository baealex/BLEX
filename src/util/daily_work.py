import os
import sys
import django
import datetime

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.db.models import F
from django.utils import timezone

from board.models import Config, Profile, PostAnalytics, ThreadAnalytics

for config in Config.objects.all():
    if not config.telegram_token == '':
        config.telegram_token = ''
        config.save()
print('ALL CONFIGS DONE!')

profiles = Profile.objects.filter(exp__gt=0)
for profile in profiles:
    profile.exp = F('exp') - 1
    profile.save()
print('ALL PROFILES DONE!')

yesterday = timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=1))
posts = PostAnalytics.objects.filter(date=yesterday)
threads = ThreadAnalytics.objects.filter(date=yesterday)
for data in chain(posts, threads):
    data.iptable = ''
    data.save()
print('ALL ANALITICS DONE!')