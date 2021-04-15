import os
import re
import sys
import html
import time
import django
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *

rfs = RefererFrom.objects.filter(title='')

for rf in rfs:
    response = requests.get(rf.location)
    title = re.search(r'<title.*?>(.+?)</title>', response.text)
    if title:
        rf.title = html.unescape(title.group(1))
    if not title:
        rf.title = rf.location.split('//')[1].split('/')[0]
    print(rf.title)
    time.sleep(10)