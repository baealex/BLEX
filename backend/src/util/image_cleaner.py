import os
import re
import sys
import time
import django
import datetime

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTENT_IMAGE_DIR = BASE_DIR + '/static/images/content'
TITLE_IMAGE_DIR   = BASE_DIR + '/static/images/title'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Comment, TempPosts, ImageCache

if __name__ == '__main__':
    image_parser = re.compile(r'\!\[.*\]\(([^\s\"]*).*\)')
    video_parser = re.compile(r'\@gif\[(.*)\]')
    src_parser = re.compile(r'src=[\'\"]([^\'\"]*)[\'\"]')

    title_image_dict = dict()
    content_image_dict = dict()

    posts = Post.objects.all()
    comments = Comment.objects.all()
    temp_posts = TempPosts.objects.all()
    
    for item in chain(posts, temp_posts, comments):
        images = image_parser.findall(item.text_md)
        videos = video_parser.findall(item.text_md)
        etc = src_parser.findall(item.text_md)
        
        for image in chain(images, videos, etc):
            content_image_dict[image.split('/')[-1]] = True
        
    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            try:
                if not content_image_dict[filename.replace('.preview.jpg', '')]:
                    pass
            except KeyError:
                print(path + '/' + filename)
                # os.remove(path + '/' + filename)

    for image_cache in ImageCache.objects.all():
        try:
            if not content_image_dict[image_cache.path.split('/')[-1]]:
                pass
        except KeyError:
            print(f'{image_cache.pk} : {image_cache.path}')
            # image_cache.delete()
            time.sleep(0.5)