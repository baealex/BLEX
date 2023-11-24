import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import *

if __name__ == '__main__':
    referers = Referer.objects.all()

    for referer in referers:
        if not referer.post:
            referer.post = referer.analytics.post
            referer.save()