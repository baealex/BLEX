import os
import re
import sys
import html
import time
import django
import urllib
import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *
from board.module.scrap import page_parser

referer_froms = RefererFrom.objects.exclude(description__contains='kb)')

if __name__ == '__main__':
    for referer_from in referer_froms:
        data = page_parser(referer_from.location)
        print(data)
        if data['title']:
            referer_from.title = data['title']
        if data['image']:
            referer_from.image = data['image']
        if data['description']:
            referer_from.description = data['description']
        referer_from.update()
        time.sleep(5)