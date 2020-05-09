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

from board.models import Post, Thread, Story, TempPosts, parsedown

if __name__ == '__main__':
    content_image_names = dict()
    content_video_names = dict()
    title_image_names = dict()

    posts = Post.objects.all()
    thread = Thread.objects.all()
    story = Story.objects.all()
    
    for data in chain(posts, thread, story):
        try:
            title_image_names[str(data.image).split('/')[-1]] = 0
            title_image_names[str(data.get_thumbnail()).split('/')[-1]] = 0
        except:
            pass
        
        try:
            soup = BeautifulSoup(data.text_html, 'html.parser')
            images = soup.select('img')
            for image in images:
                if image.get('src'):
                    content_image_names[image.get('src').split('/')[-1]] = 0
                if image.get('data-src'):
                    content_image_names[image.get('data-src').split('/')[-1]] = 0
            posters = soup.select('video')
            for poster in posters:
                if poster.get('poster'):
                    content_video_names[poster.get('poster').split('/')[-1]] = 0
            videos = soup.select('source')
            for video in videos:
                if video.get('src'):
                    content_video_names[video.get('src').split('/')[-1]] = 0
                if video.get('data-src'):
                    content_video_names[video.get('data-src').split('/')[-1]] = 0
        except:
            pass
    
    temps = TempPosts.objects.all()
    for temp in temps:
        html = parsedown(temp.text_md)
        if html == 'Temporary error':
            print(html, 'Cleaner Stop...')
            sys.exit()
        soup = BeautifulSoup(parsedown(temp.text_md), 'html.parser')
        images = soup.select('img')
        for image in images:
            if image.get('src'):
                content_image_names[image.get('src').split('/')[-1]] = 0
            if image.get('data-src'):
                content_image_names[image.get('data-src').split('/')[-1]] = 0
        posters = soup.select('video')
        for poster in posters:
            if poster.get('poster'):
                content_video_names[poster.get('poster').split('/')[-1]] = 0
        videos = soup.select('source')
        for video in videos:
            if video.get('src'):
                content_video_names[video.get('src').split('/')[-1]] = 0
            if video.get('data-src'):
                content_video_names[video.get('data-src').split('/')[-1]] = 0

    today = datetime.datetime.now()
    today_path = str(today.year) + '/' + str(today.month) + '/' + str(today.day)

    yesterday = datetime.datetime.now() - datetime.timedelta(days=1)
    yesterday_path = str(yesterday.year) + '/' + str(yesterday.month) + '/' + str(yesterday.day)

    for(path, dir, files) in os.walk(TITLE_IMAGE_DIR):
        for filename in files:
            if not filename in title_image_names:
                if today_path in path or yesterday_path in path:
                    continue
                print(path + '/' + filename)
                os.remove(path + '/' + filename)

    for (path, dir, files) in os.walk(CONTENT_IMAGE_DIR):
        for filename in files:
            if not filename in content_image_names and not filename in content_video_names:
                if today_path in path or yesterday_path in path:
                    continue
                print(path + '/' + filename)
                os.remove(path + '/' + filename)
    
    print('ALL DONE!')