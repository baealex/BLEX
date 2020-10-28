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

remove_items = [
    settings.SITE_URL,
    'in-vm',
    'AND',
    'OR',
    'IF',
    'CASE',
    'SELECT',
    '127.0.0.1'
]

for item in remove_items:
    rfs = RefererFrom.objects.filter(location__contains=item)

    for rf in rfs:
        time.sleep(1)
        rf.delete()