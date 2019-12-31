import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Profile

datas = Profile.objects.all()

if __name__ == '__main__':
    for data in datas:
        if data.exp > 0:
            data.exp -= 5
            data.save()
    print('ALL DONE!')
