from django.contrib.syndication.views import Feed
from django.utils.feedgenerator import Rss201rev2Feed

from .models import Post

class CorrectMimeTypeFeed(Rss201rev2Feed):
    content_type = 'application/xml'

class LatestPostFeed(Feed):
    feed_type = CorrectMimeTypeFeed

    title = 'BLEX'
    link = '/rss'
    description = 'BLOG EXPRESS ME'

    def items(self):
        return Post.objects.filter(hide=False).order_by('created_date').reverse()[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.text_html

    def item_link(self, item):
        return item.get_absolute_url()