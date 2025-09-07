import re
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
        # Store sensitive content blocks to preserve them
        preserved_blocks = {}
        block_counter = 0

        # Preserve script tags (JavaScript)
        def preserve_script(match):
            nonlocal block_counter
            key = f"__PRESERVED_SCRIPT_{block_counter}__"
            preserved_blocks[key] = match.group(0)
            block_counter += 1
            return key

        # Preserve style tags (CSS)
        def preserve_style(match):
            nonlocal block_counter
            key = f"__PRESERVED_STYLE_{block_counter}__"
            preserved_blocks[key] = match.group(0)
            block_counter += 1
            return key

        # Preserve pre and textarea tags (formatted content)
        def preserve_pre_textarea(match):
            nonlocal block_counter
            key = f"__PRESERVED_PRE_{block_counter}__"
            preserved_blocks[key] = match.group(0)
            block_counter += 1
            return key

        # Preserve Alpine.js attributes and x-data content
        def preserve_alpine_data(match):
            nonlocal block_counter
            key = f"__PRESERVED_ALPINE_{block_counter}__"
            preserved_blocks[key] = match.group(0)
            block_counter += 1
            return key

        # Store all sensitive content
        html = re.sub(r'<script\b[^>]*>.*?</script>', preserve_script, html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style\b[^>]*>.*?</style>', preserve_style, html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<(pre|textarea)\b[^>]*>.*?</\1>', preserve_pre_textarea, html, flags=re.DOTALL | re.IGNORECASE)
        
        # Preserve Alpine.js x-data attributes (they contain JavaScript)
        html = re.sub(r'x-data\s*=\s*"[^"]*"', preserve_alpine_data, html, flags=re.IGNORECASE)
        html = re.sub(r"x-data\s*=\s*'[^']*'", preserve_alpine_data, html, flags=re.IGNORECASE)

        # Now perform safe minification
        # Remove HTML comments (but not IE conditional comments)
        html = re.sub(r'<!--(?!\[if).*?-->', '', html, flags=re.DOTALL)
        
        # Remove unnecessary whitespace between tags, but preserve single spaces
        # This prevents text from sticking together
        html = re.sub(r'>\s+<', '><', html)
        
        # Remove leading/trailing whitespace from lines, but keep line breaks for inline elements
        lines = html.split('\n')
        cleaned_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                cleaned_lines.append(stripped)
        html = '\n'.join(cleaned_lines)
        
        # Compress multiple consecutive whitespace characters to single space
        # But preserve intentional spacing in text content
        html = re.sub(r'[ \t]+', ' ', html)
        
        # Remove unnecessary line breaks (but keep some for readability and text flow)
        html = re.sub(r'\n\s*\n', '\n', html)

        # Restore all preserved content
        for key, content in preserved_blocks.items():
            html = html.replace(key, content)

        return html
