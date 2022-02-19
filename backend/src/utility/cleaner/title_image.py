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

def get_clean_filename(filename):
    if 'preview' in filename:
        filename = filename.split('.preview')[0]
    if 'minify' in filename:
        filename = filename.split('.minify')[0]
    return filename

if __name__ == '__main__':
    used_filename_dict = dict()

    posts = Post.objects.all()

    for post in posts:
        if post.image:
            used_filename_dict[str(post.image).split('/')[-1]] = True
    
    for (path, dir, files) in os.walk(TITLE_IMAGE_DIR):
        for filename in files:
            filename_for_search = get_clean_filename(filename)
            
            if not filename_for_search in used_filename_dict:
                print(f'Remove file : {path}/{filename}')
                os.remove(path + '/' + filename)
                time.sleep(0.1)