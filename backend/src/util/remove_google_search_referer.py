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

google_com = RefererFrom.objects.get(location='https://www.google.com/')

rferers = Referer.objects.filter(referer_from__location__contains='google')

print('change referers')
for rf in rferers:
    if 'url' in rf.referer_from.location:
        time.sleep(1)
        print(str(rf.pk) + ' : ' + rf.referer_from.location)
        rf.referer_from = google_com
        rf.save()

rfs = RefererFrom.objects.filter(location__contains='google')

print('remove referer_froms')
for rf in rfs:
    refs = Referer.objects.filter(referer_from=rf).count()
    if refs == 0:
        time.sleep(1)
        print(str(rf.pk) + ' : ' + rf.location)
        rf.delete()