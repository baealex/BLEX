from django.contrib.sitemaps import Sitemap
from django.core.cache import cache
from django.urls import reverse
from itertools import chain

from board.models import Post, Series, Profile
from board.views.function import get_clean_all_tags

class StaticSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0
    
    def items(self):
        return ('', '/popular', '/tags')
    
    def location(self, item):
        return str(item)

class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.8

    def items(self):
        return Post.objects.filter(hide=False).order_by('-updated_date')
    
    def lastmod(self, element):
        return element.updated_date

class SeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Series.objects.filter(hide=False).order_by('pk')

class UserSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        users = Profile.objects.all().order_by('pk')
        user_site = []
        for user in users:
            user_site += [
                reverse('user_profile', args=[user]),
                reverse('user_profile_tab', args=[user, 'about']),
                reverse('user_profile_tab', args=[user, 'series']),
                reverse('user_profile_tab', args=[user, 'posts']),
                # reverse('user_profile_posts', args=[user]),
            ]
        return user_site
    
    def location(self, item):
        return str(item)

class TopicSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return tuple(get_clean_all_tags(count=False))
    
    def location(self, item):
        return reverse('post_list_in_tag', args=[item])

class UserTopicSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        profiles = Profile.objects.all().order_by('pk')
        tags = list()
        for profile in profiles:
            for tag in get_clean_all_tags(user=profile.user, count=False):
                tags.append({'user': profile.user.username, 'topic': tag})
        return tags
    
    def location(self, item):
        return reverse('user_profile_posts', args=[item['user'], item['topic']])

sitemaps = {
    'static_sitemap': StaticSitemap,
    'user_sitemap': UserSitemap,
    'posts_sitemap': PostsSitemap,
    # 'series_sitemap': SeriesSitemap,
    # 'topic_sitemap': TopicSitemap,
}