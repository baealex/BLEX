import os
import sys
import django
import datetime

from itertools import chain
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTENT_IMAGE_DIR = BASE_DIR + '/static/images/content'
TITLE_IMAGE_DIR   = BASE_DIR + '/static/images/title'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Comment, TempPosts, ImageCache, parsedown
import board.views_fn as fn

def image_caching(image_key, path):
    try:
        image_cache = ImageCache.objects.get(key=image_key)
        print('cache hit!!!')
        return True, image_cache.path
    except:
        image_cache = ImageCache(key=image_key, path=path)
        image_cache.save()
        print('cache not hit!')
        return False, path

if __name__ == '__main__':
    posts = Post.objects.all()
    comments = Comment.objects.all()
    
    for data in chain(posts, comments):
        soup = BeautifulSoup(data.text_html, 'html.parser')
        images = soup.select('img')
        for image in images:
            if image.get('data-src'):
                src = image.get('data-src').replace('https://static.blex.me', '')
                try:
                    with open(BASE_DIR + '/static' + src, 'rb') as f:
                        image_key = fn.get_hash_key(f.read())
                        result, new_path = image_caching(image_key, src)
                        if not src == new_path and result:
                            data.text_html = data.text_html.replace(src, new_path)
                            data.text_md = data.text_md.replace(src, new_path)
                            data.save()
                        else:
                            print('pass')
                except:
                    pass
    
    temps = TempPosts.objects.all()
    for temp in temps:
        html = parsedown(temp.text_md)
        if html == 'Temporary error':
            print(html, 'Cleaner Stop...')
            sys.exit()
        soup = BeautifulSoup(html, 'html.parser')
        images = soup.select('img')
        for image in images:
            if image.get('data-src'):
                src = image.get('data-src').replace('https://static.blex.me', '')
                with open(BASE_DIR + '/static' + src, 'rb') as f:
                    image_key = fn.get_hash_key(f.read())
                    result, new_path = image_caching(image_key, src)
                    if not src == new_path and result:
                        data.text_html = data.text_html.replace(src, new_path)
                        data.text_md = data.text_md.replace(src, new_path)
                        data.save()
                    else:
                        print('pass')