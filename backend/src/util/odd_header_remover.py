import os
import sys
import django
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.conf import settings

from board.models import *

posts = Post.objects.all()

for post in posts:
    should_save = False
    if '<h1' in post.text_html:
        post.text_html = post.text_html.replace('<h1', '<h2')
        post.text_html = post.text_html.replace('</h1>', '</h2>')
        should_save = True
    if '<h3' in post.text_html:
        post.text_html = post.text_html.replace('<h3', '<h4')
        post.text_html = post.text_html.replace('</h3>', '</h4>')
        should_save = True
    if '<h5' in post.text_html:
        post.text_html = post.text_html.replace('<h5', '<h6')
        post.text_html = post.text_html.replace('</h5>', '</h6>')
        should_save = True
    if should_save:
        print(post.title)
        post.save()
    time.sleep(0.1)