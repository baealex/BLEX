import os
import re
import sys
import time
import django
import datetime

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

TITLE_IMAGE_DIR   = BASE_DIR + '/static/images/title'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Comment, TempPosts, ImageCache

if __name__ == '__main__':
    image_dict = dict()

    posts = Post.objects.all()

    for post in posts:
        if post.image:
            image_dict[str(post.image).split('/')[-1]] = True
    
    for (path, dir, files) in os.walk(TITLE_IMAGE_DIR):
        for filename in files:
            fname = filename.replace('.preview.jpg', '')
            if 'minify' in fname:
                fname = fname.split('.minify')[0]
            
            if not fname in image_dict:
                print(path + '/' + filename)
                os.remove(path + '/' + filename)
            time.sleep(0.01)