import os
import sys
import django
import datetime

from itertools import chain

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

sys.path.append(BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from django.db.models import F
from django.utils import timezone

from board.models import *

def migrate_story_to_post():
    story = Story.objects.all()
    for s in story:
        print(s)
        new_post = Post()
        new_post.author = s.author
        new_post.title = s.title
        new_post.url = s.url
        new_post.text_md = s.text_md
        new_post.text_html = s.text_html
        new_post.created_date = s.created_date
        new_post.updated_date = s.updated_date
        new_post.tag = s.thread.tag
        new_post.hide = s.thread.hide
        i = 1
        while True:
            try:
                new_post.save()
                break
            except:
                new_post.url = new_post.url+'-'+str(i)
                i += 1

def remove_all_story():
    story = Story.objects.all().delete()

def migrate_thread_to_series():
    thread = Thread.objects.all()
    for t in thread:
        print(t)
        new_series = Series()
        new_series.owner = t.author
        new_series.name = t.title + '_book'
        new_series.description = t.description
        new_series.description_html = parsedown(t.description)
        new_series.url = t.url
        new_series.created_date = t.real_created_date
        new_series.layout = 'book'

        i = 1
        while True:
            try:
                new_series.save()
                break
            except:
                new_series.url = new_series.url+'-'+str(i)
                i += 1
        
        new_series.refresh_from_db()

        story = Story.objects.filter(thread=t)
        for s in story:
            print(s)
            post = Post.objects.get(created_date=s.created_date, updated_date=s.updated_date)
            new_series.posts.add(post)

def remove_all_thread():
    thread = Thread.objects.all().delete()

def referer_to_referers():
    post_analytics = PostAnalytics.objects.all()
    for items in post_analytics:
        items_split = items.referer.split('|')
        for item in items_split:
            item_split = item.split('^')

            if len(item_split) < 2:
                continue

            time = item_split[0]
            referer = item_split[1][:500]

            new_referer_from = None
            try:
                new_referer_from = RefererFrom.objects.get(location=referer)
            except:
                new_referer_from = RefererFrom(location=referer)
                new_referer_from.save()
                new_referer_from.refresh_from_db()

            _date = str(items.date).split('-')
            _time = str(time).split(':')
            if len(_time) < 2:
                continue
            
            print(_date, _time, referer)
                
            timedata = timezone.make_aware(datetime.datetime(
                int(_date[0]),
                int(_date[1]),
                int(_date[2]),
                int(_time[0]),
                int(_time[1]),
            ))
            Referer(
                posts = items,
                referer_from = new_referer_from,
                created_date = timedata
            ).save()
        items.referer = 'DONE!'
        items.save()

if __name__ == '__main__':
    migrate_story_to_post()
    migrate_thread_to_series()
    remove_all_story()
    remove_all_thread()
    referer_to_referers()
    print('Done')