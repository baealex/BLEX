import os
import sys
import django
import time
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings
from django.contrib.auth.models import User

if __name__ == '__main__':
    username = ''

    if len(sys.argv) > 1 and sys.argv[1]:
        username = sys.argv[1]
    else:
        username = input('Input username : ')
    
    user = User.objects.get(username=username)
    answer = input(f"make a superuser {user.first_name}? (Y/N) ").upper()
    
    if answer == 'Y':
        user.is_superuser = True
        user.save()
    if answer == 'N':
        user.is_superuser = False
        user.save()
    
    superusers = User.objects.filter(is_superuser=True)
    print(f"Now superuser is {superusers.count()}")
    print('DONE')