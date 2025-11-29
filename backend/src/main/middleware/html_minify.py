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
        """
        Minify HTML using the minify-html library.
        This library is:
        - Rust-based (10-15x faster than pure Python)
        - Safely preserves Alpine.js, Vue.js, React attributes
        - Well-maintained and battle-tested
        """
        try:
            return minify_html.minify(
                html,
                minify_js=True,           # Minify inline JavaScript
                minify_css=True,          # Minify inline CSS
                keep_closing_tags=True,   # Keep closing tags for compatibility
                keep_html_and_head_opening_tags=True,  # Preserve document structure
                keep_spaces_between_attributes=True,   # Safer for Alpine.js/Vue
                do_not_minify_doctype=True,            # Preserve DOCTYPE
                ensure_spec_compliant_unquoted_attribute_values=True,  # Spec compliance
                keep_comments=False,      # Remove HTML comments
            )
        except Exception as e:
            # If minification fails, return original HTML to prevent breaking the page
            print(f"HTML minification error: {e}")
            return html
