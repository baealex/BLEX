import re
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings

from modules.markdown import parse_post_to_html

from board.modules.read_time import calc_read_time


class PostContentService:
    MEDIA_PATH_PREFIXES = ('/resources/media/',)
    MEDIA_URL_ATTRIBUTES = {
        'img': ('src', 'data-src', 'srcset'),
        'video': ('src', 'poster', 'data-src'),
        'source': ('src', 'data-src', 'srcset'),
    }
    ATTRIBUTE_PATTERN = re.compile(
        r'(?P<prefix>\s(?P<name>[a-zA-Z:-]+)\s*=\s*)'
        r'(?:(?P<quote>["\'])(?P<quoted_value>.*?)(?P=quote)|(?P<unquoted_value>[^\s"\'=<>`]+))',
        re.DOTALL,
    )

    @staticmethod
    def _configured_site_origin() -> str:
        parsed = urlsplit((settings.SITE_URL or '').strip())
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            return ''
        return f'{parsed.scheme}://{parsed.netloc}'.lower()

    @staticmethod
    def _media_path_prefixes() -> tuple[str, ...]:
        prefixes = set(PostContentService.MEDIA_PATH_PREFIXES)
        media_url_path = urlsplit(settings.MEDIA_URL or '').path

        if media_url_path:
            prefixes.add(media_url_path)

        return tuple(
            prefix if prefix.endswith('/') else f'{prefix}/'
            for prefix in prefixes
        )

    @staticmethod
    def _is_media_path(path: str) -> bool:
        return any(
            path.startswith(prefix)
            for prefix in PostContentService._media_path_prefixes()
        )

    @staticmethod
    def _normalize_media_url(url: str) -> str:
        if not url:
            return url

        parsed = urlsplit(url)
        if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
            return url

        site_origin = PostContentService._configured_site_origin()
        url_origin = f'{parsed.scheme}://{parsed.netloc}'.lower()

        if not site_origin or url_origin != site_origin:
            return url

        if not PostContentService._is_media_path(parsed.path):
            return url

        return urlunsplit(('', '', parsed.path, parsed.query, parsed.fragment))

    @staticmethod
    def _normalize_srcset(value: str) -> str:
        candidates = []
        changed = False

        for candidate in PostContentService._split_srcset_candidates(value):
            stripped = candidate.strip()
            if not stripped or stripped.startswith('data:'):
                candidates.append(candidate)
                continue

            parts = stripped.split()
            normalized_url = PostContentService._normalize_media_url(parts[0])
            if normalized_url == parts[0]:
                candidates.append(candidate)
                continue

            changed = True
            candidates.append(' '.join([normalized_url, *parts[1:]]))

        return ', '.join(candidates) if changed else value

    @staticmethod
    def _split_srcset_candidates(value: str) -> list[str]:
        candidates = []
        start = 0
        in_data_url = False
        saw_non_whitespace = False
        saw_whitespace_after_url = False

        def reset_candidate_state() -> None:
            nonlocal in_data_url, saw_non_whitespace, saw_whitespace_after_url
            in_data_url = False
            saw_non_whitespace = False
            saw_whitespace_after_url = False

        for index, char in enumerate(value):
            if not saw_non_whitespace and not char.isspace():
                saw_non_whitespace = True
                in_data_url = value[index:].lower().startswith('data:')
            elif in_data_url and saw_non_whitespace and char.isspace():
                saw_whitespace_after_url = True

            if char != ',':
                continue
            if in_data_url and not saw_whitespace_after_url:
                continue

            candidates.append(value[start:index])
            start = index + 1
            reset_candidate_state()

        candidates.append(value[start:])
        return candidates

    @staticmethod
    def _normalize_media_start_tag(tag_name: str, raw_tag: str) -> str:
        allowed_attributes = PostContentService.MEDIA_URL_ATTRIBUTES[tag_name]

        def normalize_attribute(attribute_match: re.Match) -> str:
            attribute_name = attribute_match.group('name').lower()
            if attribute_name not in allowed_attributes:
                return attribute_match.group(0)

            quote = attribute_match.group('quote')
            value = (
                attribute_match.group('quoted_value')
                if quote
                else attribute_match.group('unquoted_value')
            )
            normalized = (
                PostContentService._normalize_srcset(value)
                if attribute_name == 'srcset'
                else PostContentService._normalize_media_url(value)
            )

            if normalized == value:
                return attribute_match.group(0)

            if quote:
                return f"{attribute_match.group('prefix')}{quote}{normalized}{quote}"
            return f"{attribute_match.group('prefix')}{normalized}"

        return PostContentService.ATTRIBUTE_PATTERN.sub(
            normalize_attribute,
            raw_tag,
        )

    @staticmethod
    def normalize_content_html(html: str) -> str:
        if not html:
            return ''

        site_origin = PostContentService._configured_site_origin()
        if not site_origin or site_origin not in html.lower():
            return html

        class MediaUrlParser(HTMLParser):
            def __init__(self, source: str):
                super().__init__(convert_charrefs=False)
                self.source = source
                self.line_offsets = [0]
                for newline in re.finditer('\n', source):
                    self.line_offsets.append(newline.end())
                self.cursor = 0
                self.parts: list[str] = []
                self.failed = False

            def replace_start_tag(self, tag: str) -> None:
                raw_tag = self.get_starttag_text()
                if raw_tag is None:
                    self.failed = True
                    return

                line_number, offset = self.getpos()
                line_index = line_number - 1
                if line_index < 0 or line_index >= len(self.line_offsets):
                    self.failed = True
                    return

                tag_index = self.line_offsets[line_index] + offset
                if self.source[tag_index:tag_index + len(raw_tag)] != raw_tag:
                    self.failed = True
                    return

                self.parts.append(self.source[self.cursor:tag_index])
                tag_name = tag.lower()
                if tag_name in PostContentService.MEDIA_URL_ATTRIBUTES:
                    self.parts.append(
                        PostContentService._normalize_media_start_tag(tag_name, raw_tag)
                    )
                else:
                    self.parts.append(raw_tag)
                self.cursor = tag_index + len(raw_tag)

            def handle_starttag(self, tag: str, attrs) -> None:
                self.replace_start_tag(tag)

            def handle_startendtag(self, tag: str, attrs) -> None:
                self.replace_start_tag(tag)

        parser = MediaUrlParser(html)
        parser.feed(html)
        parser.close()

        if parser.failed:
            return html

        parser.parts.append(html[parser.cursor:])
        return ''.join(parser.parts)

    @staticmethod
    def html_input_to_content_html(html: str) -> str:
        return PostContentService.normalize_content_html(html)

    @staticmethod
    def markdown_input_to_content_html(markdown_text: str) -> str:
        return PostContentService.normalize_content_html(
            parse_post_to_html(markdown_text or '')
        )

    @staticmethod
    def input_to_content_html(content: str, content_type: str | None = None) -> str:
        if content_type == 'markdown':
            return PostContentService.markdown_input_to_content_html(content)
        return PostContentService.html_input_to_content_html(content)

    @staticmethod
    def sync_parent_read_time(post, content_html: str) -> None:
        post.read_time = calc_read_time(content_html)
        post.save()

    @staticmethod
    def create_for_post(post, content_html: str):
        from board.models import PostContent

        PostContentService.sync_parent_read_time(post, content_html)
        post_content = PostContent(post=post, content_html=content_html)
        post_content._skip_read_time_sync = True
        try:
            post_content.save()
        finally:
            delattr(post_content, '_skip_read_time_sync')
        return post_content

    @staticmethod
    def update_content(post_content, content_html: str):
        PostContentService.sync_parent_read_time(post_content.post, content_html)
        post_content.content_html = content_html
        post_content._skip_read_time_sync = True
        try:
            post_content.save()
        finally:
            delattr(post_content, '_skip_read_time_sync')
        return post_content
