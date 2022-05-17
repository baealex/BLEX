from django.contrib.sitemaps import Sitemap
from django.core.cache import cache
from django.core.paginator import Paginator
from django.urls import reverse
from itertools import chain

from board.models import Post, Series, Profile

class StaticSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0
    
    def items(self):
        return ('', '/newest', '/tags')
    
    def location(self, item):
        return str(item)

class StaticPaginationSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0
    
    def items(self):
        posts = Post.objects.filter(config__hide=False).order_by('-updated_date')
        posts = Paginator(posts, 24)

        items = []
        for i in range(2, posts.num_pages + 1):
            items.append(f"/?page={i}")
        
        return items
    
    def location(self, item):
        return str(item)

class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.8

    def items(self):
        return Post.objects.filter(config__hide=False).order_by('-updated_date')
    
    def lastmod(self, element):
        return element.updated_date

class UserSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        users = Profile.objects.all().order_by('pk')
        user_site = []
        for user in users:
            user_site += [
                reverse('user_profile', args=[user]),
                # reverse('user_profile_tab', args=[user, 'about']),
                # reverse('user_profile_tab', args=[user, 'series']),
                # reverse('user_profile_tab', args=[user, 'posts']),
                # reverse('user_profile_posts', args=[user]),
            ]
        return user_site
    
    def location(self, item):
        return str(item)

sitemaps = {
    'static_sitemap': StaticSitemap,
    'static_pagination_sitemap': StaticPaginationSitemap,
    'user_sitemap': UserSitemap,
    # 'posts_sitemap': PostsSitemap,
}