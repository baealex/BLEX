import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, PostContent, PostConfig

if __name__ == '__main__':
    posts = Post.objects.all()

    for post in posts:
        print(post)

        post.published_date = post.created_date
        post.save()
        time.sleep(0.05)