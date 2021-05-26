import os
import sys
import html
import urllib
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *

rfs = RefererFrom.objects.exclude(title='')

for rf in rfs:
    rf.title = html.unescape(rf.title)
    rf.title = urllib.parse.unquote(rf.title)
    print(rf.title)
    if 'http://' in rf.title or 'https://' in rf.title:
        rf.title = rf.location.split('//')[1].split('/')[0]
    rf.save()
    time.sleep(0.3)