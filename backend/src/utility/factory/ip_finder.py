import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import History
from modules.hash import get_sha256

if __name__ == '__main__':
    histories = History.objects.filter(ip='').order_by('-ip')
    count = histories.count()
    print(count)

    keys = {}
    for history in histories:
        keys[history.key] = True

    for x1 in range(256):
        for x2 in range(256):
            for x3 in range(256):
                for x4 in range(256):
                    ip = f'{x1}.{x2}.{x3}.{x4}'
                    key = get_sha256(ip)

                    if keys.get(key, ''):
                        count -= 1
                        print(count, ip)
                        history = histories.get(key=key)
                        history.ip = ip
                        history.save()
                        time.sleep(0.01)

    print('=== end ===')