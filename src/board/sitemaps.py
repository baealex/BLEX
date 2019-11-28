from django.contrib.sitemaps import Sitemap
from .models import Post

class PostSitemap(Sitemap):
    changefreq = 'weekly'
    priority = 0.5
    def items(self):
        return Post.objects.filter(created_date__isnull=False, hide=False).order_by('created_date')
    def lastmod(self, obj):
        return obj.updated_date

sitemaps = {
    'posts': PostSitemap,
}