import os
import sys
import time
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import *

if __name__ == '__main__':
    referers = Referer.objects.filter(post=None).order_by('-created_date')
    total_count = referers.count()
    count = 0

    for referer in referers:
        referer.post = referer.analytics.post
        referer.save()
        count += 1
        print(f'{count} / {total_count}')
        time.sleep(0.01)
