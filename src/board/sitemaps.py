from django.contrib.sitemaps import Sitemap
from itertools import chain

from .models import Post, Thread, Series, Profile

class PostSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        posts = Post.objects.filter(hide=False)
        series = Series.objects.all()
        profiles = Profile.objects.all()
        threads = Thread.objects.filter(hide=False)
        return sorted(chain(posts, threads, series, profiles), key=self.lastmod)
    def lastmod(self, element):
        if hasattr(element, 'updated_date'):
            return element.updated_date
        elif hasattr(element, 'created_date'):
            return element.created_date
        else:
            return element.user.date_joined


sitemaps = {
    'posts': PostSitemap,
}