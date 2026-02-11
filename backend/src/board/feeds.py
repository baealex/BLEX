import re

from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed
from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse

from board.models import Post
from board.modules.time import convert_to_localtime


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
        posts = Post.objects.filter(
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).select_related('content').order_by('-created_date')
        return posts[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', item.content.text_html)

    def item_link(self, item):
        return item.get_absolute_url()

    def item_pubdate(self, item):
        return convert_to_localtime(item.created_date)


class UserPostsFeed(Feed):
    feed_type = ImageRssFeedGenerator

    def items(self, item):
        posts = Post.objects.filter(
            author=item,
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).select_related('content').order_by('-created_date')
        return posts[:20]
    
    def get_object(self, request, username):
        return User.objects.select_related('profile').get(username=username)

    def title(self, item):
        return f'{item.username} ({item.first_name})'

    def link(self, item):
        return reverse('user_profile', args=[item.username])

    def description(self, item):
        if hasattr(item, 'profile') and item.profile.bio:
            return item.profile.bio
        else:
            return item.username + '\'s rss'

    def feed_extra_kwargs(self, item):
        return {'image_url': item.profile.get_thumbnail()}

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F]', '', item.content.text_html)

    def item_link(self, item):
        return item.get_absolute_url()

    def item_pubdate(self, item):
        return convert_to_localtime(item.created_date)
