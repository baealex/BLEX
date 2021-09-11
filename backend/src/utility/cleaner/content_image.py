import os
import re
import sys
import time
import django
import datetime

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

CONTENT_IMAGE_DIR = BASE_DIR + '/static/images/content'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Comment, TempPosts, ImageCache

if __name__ == '__main__':
    image_parser = re.compile(r'\!\[.*\]\(([^\s\"]*).*\)')
    video_parser = re.compile(r'\@gif\[(.*)\]')
    src_parser = re.compile(r'src=[\'\"]([^\'\"]*)[\'\"]')

    image_dict = dict()

    posts = Post.objects.all()
    comments = Comment.objects.all()
    temp_posts = TempPosts.objects.all()
    
    for item in chain(posts, temp_posts, comments):
        images = image_parser.findall(item.text_md)
        videos = video_parser.findall(item.text_md)
        etc = []
        if hasattr(item, 'text_html'):
            etc = src_parser.findall(item.text_html)
        else:
            etc = src_parser.findall(item.text_md)
        
        for image in chain(images, videos, etc):
            fname = image.split('/')[-1]
            if 'preview' in fname:
                fname = fname.split('.preview')[0]
            if 'minify' in fname:
                fname = fname.split('.minify')[0]
            image_dict[fname] = True
        
    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            fname = filename
            if 'preview' in fname:
                fname = fname.split('.preview')[0]
            if 'minify' in fname:
                fname = fname.split('.minify')[0]
            
            if not fname in image_dict:
                print(path + '/' + filename)
                os.remove(path + '/' + filename)
                time.sleep(0.1)

    for image_cache in ImageCache.objects.all():
        fname = image_cache.path.split('/')[-1]
        
        if not fname in image_dict:
            print(f'{image_cache.pk} : {image_cache.path}')
            image_cache.delete()
            time.sleep(0.1)
            