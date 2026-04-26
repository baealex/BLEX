from django.utils.deprecation import MiddlewareMixin

from board.services.agent_content_service import AgentContentService


class SearchIndexingMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        if response.status_code == 200 and not AgentContentService.is_seo_enabled():
            response['X-Robots-Tag'] = 'noindex, nofollow'

        return response
