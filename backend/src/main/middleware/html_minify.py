import minify_html
from django.utils.deprecation import MiddlewareMixin


class HTMLMinifyMiddleware(MiddlewareMixin):
    def __init__(self, get_response):
        self.get_response = get_response
        super().__init__(get_response)

    def process_response(self, request, response):
        # Only minify HTML responses
        if (response.status_code == 200 and
            response.get('Content-Type', '').startswith('text/html')):

            content = response.content.decode('utf-8')
            minified_content = self.minify_html(content)
            response.content = minified_content.encode('utf-8')
            response['Content-Length'] = len(response.content)

        return response

    def minify_html(self, html):
        try:
            return minify_html.minify(
                html,
                minify_js=True,
                minify_css=True,
                keep_closing_tags=True,
                keep_html_and_head_opening_tags=True,
                keep_comments=False,
            )
        except Exception as e:
            print(f"HTML minification error: {e}")
            return html
