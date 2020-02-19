import os
import sys
import django

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Thread

posts = Post.objects.all()
thread = Thread.objects.all()

for post in posts:
    if post.trendy > 0:
        post.trendy -= 1
    post.trendy += int(post.today/10)
    post.total += post.yesterday
    post.yesterday = post.today
    post.today = 0
    post.save()

for data in thread:
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