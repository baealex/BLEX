import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.contrib.auth.models import User
from board.models import Profile, Config

if __name__ == '__main__':
    username = ''

    if len(sys.argv) > 1 and sys.argv[1]:
        username = sys.argv[1]
    else:
        username = input('Input username : ')
    
    user_exists = User.objects.filter(username=username).exists()
    if user_exists:
        print(f"User {username} already exists.")
        sys.exit()
    
    password = input('Input password : ')

    user = User.objects.create_user(username=username, password=password)
    user.save()

    profile = Profile.objects.create(user=user)
    profile.save()

    config = Config.objects.create(user=user)
    config.save()

    print('DONE')
