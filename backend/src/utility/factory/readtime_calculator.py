import os
import sys
import time
import django

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.utils.html import strip_tags

from board.models import Post

if __name__ == '__main__':
    posts = Post.objects.all()

    for post in posts:
        time.sleep(0.01)
        print(post.title)
        post.read_time = int(len(strip_tags(post.text_html))/500)
        post.save()