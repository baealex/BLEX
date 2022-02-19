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

from django.db.models import F

from board.models import Post, Comment, TempPosts, ImageCache

def get_clean_filename(filename):
    if 'preview' in filename:
        filename = filename.split('.preview')[0]
    if 'minify' in filename:
        filename = filename.split('.minify')[0]
    return filename

if __name__ == '__main__':
    image_parser = re.compile(r'\!\[.*\]\(([^\s\"]*).*\)')
    video_parser = re.compile(r'\@gif\[(.*)\]')
    src_parser = re.compile(r'src=[\'\"]([^\'\"]*)[\'\"]')

    used_filename_dict = dict()

    posts = Post.objects.all().annotate(
        text_md=F('content__text_md'),
        text_html=F('content__text_html')
    )
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
        
        for path in chain(images, videos, etc):
            filename = get_clean_filename(path.split('/')[-1])
            used_filename_dict[filename] = True
        
    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            filename_for_search = get_clean_filename(filename)
            
            if not filename_for_search in used_filename_dict:
                print(f'Remove file : {path}/{filename}')
                os.remove(path + '/' + filename)
                time.sleep(0.1)

    for image_cache in ImageCache.objects.all():
        cache_filename = image_cache.path.split('/')[-1]
        
        if not cache_filename in used_filename_dict:
            print(f'Remove cache : {image_cache.pk} - {image_cache.path}')
            image_cache.delete()
            time.sleep(0.1)
            