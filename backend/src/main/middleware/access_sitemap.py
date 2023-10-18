from django.utils.deprecation import MiddlewareMixin
from django.urls import reverse
from django.http import Http404

class AccessSitemapOnlyBot(MiddlewareMixin):
    def process_request(self, request):
        if request.path.startswith(reverse('sitemap')) \
            or request.path.startswith(reverse('sitemap_section', args=['posts'])) \
            or request.path.startswith(reverse('sitemap_section', args=['series'])) \
            or request.path.startswith(reverse('sitemap_section', args=['user'])):
            if not 'bot' in request.META.get('HTTP_USER_AGENT', '').lower():
                raise Http404
