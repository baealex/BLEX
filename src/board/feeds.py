from itertools import chain
from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Post, Story

class CorrectMimeTypeFeed(Rss201rev2Feed):
    content_type = 'application/xml'

class SitePostsFeed(Feed):
    feed_type = CorrectMimeTypeFeed

    title = 'BLEX'
    link = '/'
    description = 'BLOG EXPRESS ME'

    def items(self):
        posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False)
        stories = Story.objects.filter(created_date__lte=timezone.now(), thread__hide=False)
        return sorted(chain(posts, stories), key=lambda instance: instance.created_date, reverse=True)[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.text_html

    def item_link(self, item):
        return item.get_absolute_url()
    
    def item_pubdate(self, item):
        return item.created_date

class UserPostsFeed(Feed):
    feed_type = CorrectMimeTypeFeed

    def get_object(self, request, username):
        return User.objects.get(username=username)

    def title(self, obj):
        return obj.username + ' (' + obj.first_name + ')'

    def link(self, obj):
        return '/@' + obj.username

    def description(self, obj):
        if hasattr(obj, 'profile') and obj.profile.bio:
            return obj.profile.bio
        else:
            return obj.username + '\'s rss'

    def items(self, obj):
        posts = Post.objects.filter(created_date__lte=timezone.now(), author=obj, hide=False)
        stories = Story.objects.filter(created_date__lte=timezone.now(), author=obj, thread__hide=False)
        return sorted(chain(posts, stories), key=lambda instance: instance.created_date, reverse=True)[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.text_html

    def item_link(self, item):
        return item.get_absolute_url()

    def item_pubdate(self, item):
        return item.created_date