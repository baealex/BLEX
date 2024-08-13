import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.contrib.auth.models import User

from modules.randomness import randstr

if __name__ == '__main__':
    username = ''

    if len(sys.argv) > 1 and sys.argv[1]:
        username = sys.argv[1]
    else:
        username = input('Input username : ')

    new_password = randstr(16)

    user = User.objects.get(username=username)
    user.set_password(new_password)
    user.save()
 
    print('New password: ', new_password)
    print('DONE')
