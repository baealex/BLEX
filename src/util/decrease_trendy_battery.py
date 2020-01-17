import os
import sys
import django

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post

posts = Post.objects.all()

for data in posts:
    if data.trendy > 0:
        data.trendy -= 1
    data.total += data.yesterday
    data.yesterday = data.today
    data.today = 0
    data.save()
print('ALL POSTS DONE!')

from board.models import Profile

profiles = Profile.objects.all()

for data in profiles:
    if data.exp > 0:
        data.exp -= 5
        data.save()
print('ALL PROFILES DONE!')