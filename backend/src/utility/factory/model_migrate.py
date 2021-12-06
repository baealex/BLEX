import os
import sys
import django
import time
import json

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import Post, PostContent, PostConfig, Tag

if __name__ == '__main__':
    posts = Post.objects.all()

    for post in posts:
        print(post)

        # tag migrate
        tags = post.tag.split(',')
        for tag in tags:
            if tag:
                tag_object = Tag.objects.filter(value=tag)
                if not tag_object.exists():
                    Tag(value=tag).save()
                    time.sleep(0.05)
                    tag_object = Tag.objects.filter(value=tag)
                post.tags.add(tag_object.first())
                time.sleep(0.05)