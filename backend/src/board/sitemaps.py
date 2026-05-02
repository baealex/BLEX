from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from django.utils import timezone
from django.db.models import Count, Q

from board.models import Post, Series, Profile, StaticPage


class SiteSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 1.0

    def items(self):
        return [
            '',
            '/tags',
            '/authors',
            '/user/sitemap.xml',
            '/posts/sitemap.xml',
            '/series/sitemap.xml',
            '/staticpages/sitemap.xml',
        ]

    def location(self, item):
        return str(item)


class UserSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.6

    def items(self):
        # Only include users who have posts and are editors (EDITOR or ADMIN role)
        users = Post.objects.filter(
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
            author__profile__role__in=[Profile.Role.EDITOR, Profile.Role.ADMIN]
        ).values_list('author__username', flat=True).distinct()
        return users

    def location(self, item):
        return reverse('user_profile', args=[item])


class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.9

    def items(self):
        return Post.objects.filter(
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).select_related('author').order_by('-updated_date')

    def location(self, element):
        return reverse('post_detail', args=[element.author.username, element.url])

    def lastmod(self, element):
        return element.updated_date


class SeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.7

    def items(self):
        public_post_filter = Q(
            posts__published_date__isnull=False,
            posts__published_date__lte=timezone.now(),
            posts__config__hide=False,
        )
        return Series.objects.annotate(
            public_post_count=Count('posts', filter=public_post_filter, distinct=True),
        ).filter(
            hide=False,
            public_post_count__gte=1,
        ).select_related('owner').order_by('-updated_date')

    def location(self, element):
        return reverse('series_detail', args=[element.owner.username, element.url])

    def lastmod(self, element):
        return element.updated_date


class StaticPageSitemap(Sitemap):
    changefreq = 'monthly'
    priority = 0.8

    def items(self):
        return StaticPage.objects.filter(is_published=True).order_by('-updated_date')

    def location(self, element):
        return reverse('static_page', args=[element.slug])

    def lastmod(self, element):
        return element.updated_date


sitemaps = {
    'static': SiteSitemap,
}

sitemap_section = {
    'user': UserSitemap,
    'posts': PostsSitemap,
    'series': SeriesSitemap,
    'staticpages': StaticPageSitemap,
}
