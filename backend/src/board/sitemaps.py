from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from board.models import Post, Series


class SiteSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0

    def items(self):
        return [
            '',
            '/newest',
            '/user/sitemap.xml',
            '/posts/sitemap.xml',
            '/series/sitemap.xml'
        ]

    def location(self, item):
        return str(item)


class PostsSitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.9

    def items(self):
        return Post.objects.filter(config__hide=False).order_by('-updated_date')

    def lastmod(self, element):
        return element.updated_date


class UserSitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.8

    def items(self):
        users = Post.objects.filter(config__hide=False).values_list('author__username', flat=True).distinct()
        return [ reverse('user_profile', args=[user]) for user in users ]

    def location(self, item):
        return str(item)


class SeriesSitemap(Sitemap):
    changefreq = 'daily'
    priority = 0.8

    def items(self):
        return Series.objects.filter(hide=False, posts__config__hide=False).order_by('-updated_date')

    def lastmod(self, element):
        return element.updated_date


sitemaps = {
    'static': SiteSitemap,
}

sitemap_section = {
    'user': UserSitemap,
    'posts': PostsSitemap,
    'series': SeriesSitemap,
}
