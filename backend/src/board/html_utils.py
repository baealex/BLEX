"""
Utility functions for the board app
"""
from html import unescape
import re
from urllib.parse import urlsplit

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

    # HTML emitted by the Tiptap editor and the Markdown renderer.  This is
    # deliberately separate from ALLOWED_TAGS because site banners have a
    # smaller, legacy allowlist and are managed by staff.
    CONTENT_ALLOWED_TAGS = [
        'a', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'figcaption',
        'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'iframe',
        'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'source',
        'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot',
        'th', 'thead', 'tr', 'u', 'ul', 'video',
    ]

    CONTENT_ALLOWED_ATTRIBUTES = {
        'a': ['class', 'href', 'rel', 'target', 'title'],
        'blockquote': ['class'],
        'code': ['class'],
        'div': ['class', 'id', 'style'],
        'figcaption': ['class', 'style'],
        'figure': ['class', 'style'],
        'h1': ['class', 'id'],
        'h2': ['class', 'id'],
        'h3': ['class', 'id'],
        'h4': ['class', 'id'],
        'h5': ['class', 'id'],
        'h6': ['class', 'id'],
        'iframe': [
            'allow', 'allowfullscreen', 'class', 'frameborder', 'height',
            'loading', 'src', 'style', 'title', 'width',
        ],
        'img': [
            'alt', 'class', 'data-aspect-ratio', 'data-src', 'height',
            'loading', 'src', 'srcset', 'style', 'title', 'width',
        ],
        'li': ['class'],
        'ol': ['class', 'start'],
        'p': ['class', 'id', 'style'],
        'pre': ['class'],
        'source': ['data-src', 'src', 'type'],
        'span': ['class', 'id', 'style'],
        'table': ['class'],
        'tbody': ['class'],
        'td': ['class', 'colspan', 'rowspan'],
        'tfoot': ['class'],
        'th': ['class', 'colspan', 'rowspan', 'scope'],
        'thead': ['class'],
        'tr': ['class'],
        'ul': ['class'],
        'video': [
            'autoplay', 'class', 'controls', 'data-aspect-ratio', 'height',
            'loop', 'muted', 'playsinline', 'poster', 'preload', 'src',
            'style', 'width',
        ],
    }

    DANGEROUS_TAGS = {
        'applet', 'base', 'embed', 'form', 'meta', 'noscript', 'object',
        'script', 'style', 'template',
    }
    URL_ATTRIBUTES = {'data-src', 'href', 'poster', 'src'}
    SAFE_URL_SCHEMES = {'http', 'https', 'mailto'}
    SAFE_MEDIA_URL_SCHEMES = {'http', 'https'}
    SAFE_CSS_PROPERTIES = {
        'align-items', 'aspect-ratio', 'background-color', 'border',
        'border-radius', 'box-shadow', 'color', 'display', 'flex-direction',
        'gap', 'grid-template-columns', 'height', 'justify-content',
        'margin', 'margin-left', 'margin-right', 'max-height', 'max-width',
        'min-width', 'object-fit', 'overflow', 'padding', 'text-align',
        'text-decoration', 'width',
    }
    DANGEROUS_CSS_PATTERNS = (
        'expression', 'javascript', 'vbscript', 'url(', '@import',
        'behavior', '-moz-binding',
    )

    @classmethod
    def sanitize(cls, html_content: str) -> str:
        return cls._sanitize(
            html_content,
            allowed_tags=cls.ALLOWED_TAGS,
            allowed_attributes=cls.ALLOWED_ATTRIBUTES,
            allow_data_attributes=False,
        )

    @classmethod
    def sanitize_content(cls, html_content: str) -> str:
        """Sanitize post/comment HTML while preserving editor markup."""
        return cls._sanitize(
            html_content,
            allowed_tags=cls.CONTENT_ALLOWED_TAGS,
            allowed_attributes=cls.CONTENT_ALLOWED_ATTRIBUTES,
            allow_data_attributes=True,
        )

    @classmethod
    def _sanitize(
        cls,
        html_content: str,
        *,
        allowed_tags: list[str],
        allowed_attributes: dict[str, list[str]],
        allow_data_attributes: bool,
    ) -> str:
        if not html_content:
            return ''

        soup = BeautifulSoup(html_content, 'lxml')
        cls.remove_dangerous_tags(soup)

        for tag in list(soup.find_all(True)):
            if tag.name:
                cls.sanitize_tag(
                    tag,
                    allowed_tags=allowed_tags,
                    allowed_attributes=allowed_attributes,
                    allow_data_attributes=allow_data_attributes,
                )

        return cls.extract_body_content(soup)

    @classmethod
    def remove_dangerous_tags(cls, soup):
        for tag_name in cls.DANGEROUS_TAGS:
            for tag in soup.find_all(tag_name):
                tag.decompose()

    @classmethod
    def sanitize_tag(
        cls,
        tag,
        *,
        allowed_tags=None,
        allowed_attributes=None,
        allow_data_attributes=False,
    ):
        allowed_tags = allowed_tags or cls.ALLOWED_TAGS
        allowed_attributes = allowed_attributes or cls.ALLOWED_ATTRIBUTES

        if tag.name not in allowed_tags:
            if tag.name in cls.DANGEROUS_TAGS:
                tag.decompose()
            else:
                tag.unwrap()
            return

        allowed_attrs = set(allowed_attributes.get(tag.name, []))
        for attr in list(tag.attrs):
            attr_name = attr.lower()
            if cls.is_event_handler(attr_name):
                del tag.attrs[attr]
                continue

            is_data_attribute = allow_data_attributes and attr_name.startswith('data-')
            if attr_name not in allowed_attrs and not is_data_attribute:
                del tag.attrs[attr]
                continue

            if attr_name in cls.URL_ATTRIBUTES:
                allowed_schemes = (
                    cls.SAFE_URL_SCHEMES
                    if attr_name == 'href'
                    else cls.SAFE_MEDIA_URL_SCHEMES
                )
                if not cls.is_safe_url(
                    tag.attrs[attr],
                    allowed_schemes=allowed_schemes,
                    allow_relative=True,
                ):
                    del tag.attrs[attr]
                continue

            if attr_name == 'srcset':
                sanitized_srcset = cls.sanitize_srcset(tag.attrs[attr])
                if sanitized_srcset:
                    tag.attrs[attr] = sanitized_srcset
                else:
                    del tag.attrs[attr]
                continue

            if attr_name == 'style':
                sanitized_style = cls.sanitize_css(tag.attrs[attr])
                if sanitized_style:
                    tag.attrs[attr] = sanitized_style
                else:
                    del tag.attrs[attr]

        if tag.name == 'a' and tag.get('target') == '_blank':
            rel = tag.get('rel', [])
            if isinstance(rel, str):
                rel = rel.split()
            tag['rel'] = sorted(set(rel) | {'noopener', 'noreferrer'})

    @classmethod
    def get_attrs_to_remove(cls, tag, allowed_attrs: list) -> list:
        """Return unsafe attributes for callers using the legacy API."""
        return [
            attr for attr in tag.attrs
            if cls.is_event_handler(attr)
            or attr not in allowed_attrs
            or (
                attr in cls.URL_ATTRIBUTES
                and not cls.is_safe_url(
                    tag.attrs[attr],
                    allowed_schemes=cls.SAFE_URL_SCHEMES,
                    allow_relative=True,
                )
            )
            or (
                attr == 'style'
                and not cls.sanitize_css(tag.attrs[attr])
            )
        ]

    @staticmethod
    def is_event_handler(attr: str) -> bool:
        return attr.lower().startswith('on')

    @staticmethod
    def is_javascript_url(url) -> bool:
        if not isinstance(url, str):
            return False
        normalized = re.sub(r'[\x00-\x20]+', '', unescape(url)).lower()
        return normalized.startswith(('javascript:', 'vbscript:', 'data:'))

    @classmethod
    def is_safe_url(
        cls,
        url,
        *,
        allowed_schemes=None,
        allow_relative=True,
    ) -> bool:
        if not isinstance(url, str):
            return False

        value = unescape(url).strip()
        if any(char in value for char in '\x00\r\n\t'):
            return False

        normalized = re.sub(r'[\x00-\x20]+', '', value).lower()
        if normalized.startswith(('javascript:', 'vbscript:', 'data:')):
            return False

        try:
            parsed = urlsplit(value)
        except ValueError:
            return False

        scheme = parsed.scheme.lower()
        allowed_schemes = allowed_schemes or cls.SAFE_URL_SCHEMES
        if scheme:
            if scheme not in allowed_schemes or not parsed.netloc and scheme in {'http', 'https'}:
                return False
        elif parsed.netloc or not allow_relative:
            # Protocol-relative URLs are intentionally rejected because their
            # effective scheme depends on the embedding page.
            return False

        return True

    @classmethod
    def sanitize_srcset(cls, srcset) -> str:
        if not isinstance(srcset, str):
            return ''

        candidates = []
        for candidate in srcset.split(','):
            parts = candidate.strip().split()
            if not parts:
                continue
            if cls.is_safe_url(
                parts[0],
                allowed_schemes=cls.SAFE_MEDIA_URL_SCHEMES,
                allow_relative=True,
            ):
                candidates.append(' '.join(parts[:2]))
        return ', '.join(candidates)

    @classmethod
    def sanitize_css(cls, style_value) -> str:
        if not isinstance(style_value, str):
            return ''

        safe_declarations = []
        for declaration in style_value.split(';'):
            if ':' not in declaration:
                continue
            property_name, value = declaration.split(':', 1)
            property_name = property_name.strip().lower()
            value = value.strip()
            normalized_value = value.lower()

            if property_name not in cls.SAFE_CSS_PROPERTIES:
                continue
            if any(pattern in normalized_value for pattern in cls.DANGEROUS_CSS_PATTERNS):
                continue
            if any(char in value for char in '<>\x00\r\n'):
                continue

            safe_declarations.append(f'{property_name}: {value}')

        return '; '.join(safe_declarations)

    @classmethod
    def has_dangerous_css(cls, style_value) -> bool:
        return bool(style_value) and not cls.sanitize_css(style_value)

    @staticmethod
    def extract_body_content(soup) -> str:
        body = soup.find('body')
        if body:
            return ''.join(str(child) for child in body.children)
        return str(soup)


def sanitize_html(html_content: str) -> str:
    """Backward compatible function for HTML sanitization."""
    return HtmlSanitizer.sanitize(html_content)


def safe_external_url(url: str) -> str:
    """Return an absolute HTTP(S) URL or an empty string for unsafe input."""
    if not isinstance(url, str):
        return ''

    value = unescape(url).strip()
    if not HtmlSanitizer.is_safe_url(
        value,
        allowed_schemes={'http', 'https'},
        allow_relative=False,
    ):
        return ''
    return value


def safe_navigation_url(url: str) -> str:
    """Return a safe relative or HTTP(S) navigation URL."""
    if not isinstance(url, str):
        return ''

    value = unescape(url).strip()
    if not HtmlSanitizer.is_safe_url(
        value,
        allowed_schemes={'http', 'https', 'mailto'},
        allow_relative=True,
    ):
        return ''
    return value


def sanitize_content_html(html_content: str) -> str:
    """Sanitize HTML stored as post or comment content."""
    return HtmlSanitizer.sanitize_content(html_content)


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
