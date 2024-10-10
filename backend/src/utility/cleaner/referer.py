import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import *
from board.modules.analytics import INVALID_REFERERS

if __name__ == '__main__':
    for item in INVALID_REFERERS:
        rfs = RefererFrom.objects.filter(location__contains=item)

        for rf in rfs:
            if item in rf.location:
                print(f'Remove referer : {rf.pk} - {rf.location}')
                rf.delete()
                time.sleep(0.1)
