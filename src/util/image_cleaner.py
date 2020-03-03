import os
import sys
import django

from itertools import chain
from bs4 import BeautifulSoup

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONTENT_IMAGE_DIR = BASE_DIR + '/static/image'
TITLE_IMAGE_DIR   = BASE_DIR + '/static/title'

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Post, Thread, Story

posts = Post.objects.all()
thread = Thread.objects.all()
story = Story.objects.all()

if __name__ == '__main__':
    content_image_names = dict()
    content_video_names = dict()
    title_image_names = dict()
    
    for data in chain(posts, thread, story):
        try:
            title_image_names[str(data.image).split('/')[-1]] = 0
            title_image_names[str(data.image).split('/')[-1] + '_500.' + str(data.image).split('.')[-1]] = 0
        except:
            pass
        
        try:
            soup = BeautifulSoup(data.text_html, 'html.parser')
            images = soup.select('img')
            for image in images:
                content_image_names[image.get('src').split('/')[-1]] = 0
            videos = soup.select('source')
            for video in videos:
                content_video_names[video.get('src').split('/')[-1]] = 0
        except:
            pass
    
    for(path, dir, files) in os.walk(TITLE_IMAGE_DIR):
        for filename in files:
            if not filename in title_image_names:
                print(path + '/' + filename)
                os.remove(path + '/' + filename)

    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            if not filename in content_image_names and not filename in content_video_names:
                print(path + '/' + filename)
                os.remove(path + '/' + filename)
    
    print('ALL DONE!')