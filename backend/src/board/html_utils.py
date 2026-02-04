"""
Utility functions for the board app
"""
import re
from bs4 import BeautifulSoup


class HtmlSanitizer:
    """
    Sanitizes HTML content to prevent XSS attacks.

    - Removes <script> and <style> tags
    - Removes event handlers (onclick, onload, etc.)
    - Allows only specific safe HTML tags and attributes
    - Removes javascript: protocols from URLs
    - Removes dangerous CSS patterns (expression, import, etc.)
    """

    ALLOWED_TAGS = [
        'div', 'p', 'span', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'br', 'strong', 'em', 'b', 'i', 'u', 'blockquote',
        'code', 'pre', 'hr', 'small', 'sub', 'sup', 'mark', 'del', 'ins'
    ]

    ALLOWED_ATTRIBUTES = {
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        'div': ['class', 'id', 'style'],
        'span': ['class', 'id', 'style'],
        'p': ['class', 'id', 'style'],
        'h1': ['class', 'id'],
        'h2': ['class', 'id'],
        'h3': ['class', 'id'],
        'h4': ['class', 'id'],
        'h5': ['class', 'id'],
        'h6': ['class', 'id'],
        'code': ['class'],
        'pre': ['class'],
    }

    DANGEROUS_CSS_PATTERNS = ['expression', 'import', 'behavior', '@import']

    @classmethod
    def sanitize(cls, html_content: str) -> str:
        if not html_content:
            return ''

        soup = BeautifulSoup(html_content, 'lxml')
        cls.remove_dangerous_tags(soup)

        for tag in soup.find_all(True):
            cls.sanitize_tag(tag)

        return cls.extract_body_content(soup)

    @classmethod
    def remove_dangerous_tags(cls, soup):
        for tag_name in ['script', 'style']:
            for tag in soup.find_all(tag_name):
                tag.decompose()

    @classmethod
    def sanitize_tag(cls, tag):
        if tag.name not in cls.ALLOWED_TAGS:
            tag.unwrap()
            return

        allowed_attrs = cls.ALLOWED_ATTRIBUTES.get(tag.name, [])
        for attr in cls.get_attrs_to_remove(tag, allowed_attrs):
            del tag.attrs[attr]

    @classmethod
    def get_attrs_to_remove(cls, tag, allowed_attrs: list) -> list:
        attrs_to_remove = []
        for attr in tag.attrs:
            if cls.is_event_handler(attr):
                attrs_to_remove.append(attr)
            elif attr not in allowed_attrs:
                attrs_to_remove.append(attr)
            elif attr in ['href', 'src'] and cls.is_javascript_url(tag.attrs[attr]):
                attrs_to_remove.append(attr)
            elif attr == 'style' and cls.has_dangerous_css(tag.attrs[attr]):
                attrs_to_remove.append(attr)
        return attrs_to_remove

    @staticmethod
    def is_event_handler(attr: str) -> bool:
        return attr.startswith('on')

    @staticmethod
    def is_javascript_url(url) -> bool:
        return isinstance(url, str) and url.strip().lower().startswith('javascript:')

    @classmethod
    def has_dangerous_css(cls, style_value) -> bool:
        if not isinstance(style_value, str):
            return False
        return any(pattern in style_value.lower() for pattern in cls.DANGEROUS_CSS_PATTERNS)

    @staticmethod
    def extract_body_content(soup) -> str:
        body = soup.find('body')
        if body:
            return ''.join(str(child) for child in body.children)
        return str(soup)


def sanitize_html(html_content: str) -> str:
    """Backward compatible function for HTML sanitization."""
    return HtmlSanitizer.sanitize(html_content)


class TableOfContentsExtractor:
    """
    Extracts headings from HTML content to generate a table of contents.

    - Parses HTML to find all heading tags (h1-h6)
    - Generates unique IDs for each heading
    - Adds IDs to heading elements for anchor linking
    """

    HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']

    def __init__(self):
        self.id_counts = {}

    def generate_id(self, text: str) -> str:
        base_id = re.sub(r'[^\w\s-]', '', text.lower())
        base_id = re.sub(r'[-\s]+', '-', base_id).strip('-')

        if base_id in self.id_counts:
            self.id_counts[base_id] += 1
            return f"{base_id}-{self.id_counts[base_id]}"

        self.id_counts[base_id] = 0
        return base_id

    def extract(self, html_content: str) -> tuple:
        if not html_content:
            return html_content, []

        soup = BeautifulSoup(html_content, 'html.parser')
        headings = []

        for heading in soup.find_all(self.HEADING_TAGS):
            text = heading.get_text().strip()
            if not text:
                continue

            level = int(heading.name[1])
            heading_id = heading.get('id') or self.generate_id(text)
            heading['id'] = heading_id

            headings.append({
                'level': level,
                'text': text,
                'id': heading_id
            })

        return str(soup), headings


def extract_table_of_contents(html_content: str) -> tuple:
    """Backward compatible function for ToC extraction."""
    return TableOfContentsExtractor().extract(html_content)
