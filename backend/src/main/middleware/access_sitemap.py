from django.utils.deprecation import MiddlewareMixin


class AccessSitemapOnlyBot(MiddlewareMixin):
    """Compatibility middleware; public sitemaps must stay agent-readable."""

    def process_request(self, request):
        return None
