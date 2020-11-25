from itertools import chain
from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Post, convert_to_localtime

class CorrectMimeTypeFeed(Rss201rev2Feed):
    content_type = 'application/xml'

class ImageRssFeedGenerator(Rss201rev2Feed):
    content_type = 'application/xml'

    def add_root_elements(self, handler):
        super(ImageRssFeedGenerator, self).add_root_elements(handler)
        handler.startElement(u'image', {})
        handler.addQuickElement(u"url", self.feed['image_url'])
        handler.addQuickElement(u"title", self.feed['title'])
        handler.addQuickElement(u"link", self.feed['link'])
        handler.endElement(u'image')

class SitePostsFeed(Feed):
    feed_type = CorrectMimeTypeFeed

    title = 'BLEX'
    link = '/'
    description = 'BLOG EXPRESS ME'

    def items(self):
        posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False).order_by('-created_date')
        return posts[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.text_html

    def item_link(self, item):
        return item.get_absolute_url()
    
    def item_pubdate(self, item):
        return convert_to_localtime(item.created_date)

class UserPostsFeed(Feed):
    feed_type = ImageRssFeedGenerator

    def get_object(self, request, username):
        return User.objects.get(username=username)

    def title(self, obj):
        return obj.username + ' (' + obj.first_name + ')'

    def link(self, obj):
        return '/@' + obj.username

    def feed_extra_kwargs(self, obj):
        return {'image_url': obj.profile.get_thumbnail()}

    def description(self, obj):
        if hasattr(obj, 'profile') and obj.profile.bio:
            return obj.profile.bio
        else:
            return obj.username + '\'s rss'

    def items(self, obj):
        posts = Post.objects.filter(created_date__lte=timezone.now(), author=obj, hide=False).order_by('-created_date')
        return posts[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.text_html

    def item_link(self, item):
        return item.get_absolute_url()

    def item_pubdate(self, item):
        return convert_to_localtime(item.created_date)