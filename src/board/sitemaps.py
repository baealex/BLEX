from django.contrib.sitemaps import Sitemap
from django.urls import reverse
from itertools import chain

from .models import Post, Thread, Series, Profile, Story
from .views_fn import get_clean_all_tags

class StaticSitemap(Sitemap):
    changefreq = 'daily'
    priority = 1.0
    
    def items(self):
        return ('', '/login', '/signup', '/newest', '/tags', '/search')
    
    def location(self, item):
        return str(item)

class PostsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Post.objects.filter(hide=False).order_by('pk')
    
    def lastmod(self, element):
        return element.updated_date

class ThreadSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Thread.objects.filter(hide=False).order_by('pk')
        
    def lastmod(self, element):
        return element.created_date

class StorySitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Story.objects.filter(thread__hide=False).order_by('pk')
    
    def lastmod(self, element):
        return element.updated_date

class SeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Series.objects.all().order_by('pk')

class UserSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.8

    def items(self):
        return Profile.objects.all().order_by('pk')

class UserSeriesSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Profile.objects.all().order_by('pk')
    
    def location(self, item):
        return reverse('user_profile_tab', args=[item.user, 'series'])

class UserContentsSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Profile.objects.all().order_by('pk')
    
    def location(self, item):
        return reverse('user_profile_tab', args=[item.user, 'blog'])

class UserAboutSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5

    def items(self):
        return Profile.objects.all().order_by('pk')
    
    def location(self, item):
        return reverse('user_profile_tab', args=[item.user, 'about'])

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
        return reverse('user_profile_topic', args=[item['user'], item['topic']])

sitemaps = {
    'static_sitemap': StaticSitemap,
    
    'topic_sitemap': TopicSitemap,
    'posts_sitemap': PostsSitemap,
    'story_sitemap': StorySitemap,
    'thread_sitemap': ThreadSitemap,
    'series_sitemap': SeriesSitemap,

    'user_sitemap': UserSitemap,
    'user_topic_sitemap': UserTopicSitemap,
    'user_about_sitemap': UserAboutSitemap,
    'user_series_sitemap': UserSeriesSitemap,
    'user_contents_sitemap': UserContentsSitemap,
}