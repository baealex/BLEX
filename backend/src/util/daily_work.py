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
print('ALL CONFIGS WORK DONE!')