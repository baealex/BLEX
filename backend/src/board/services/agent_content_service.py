from __future__ import annotations

import re

from bs4 import BeautifulSoup
from bs4.element import NavigableString, Tag as SoupTag
from django.db.models import QuerySet
from django.http import Http404, HttpRequest
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostContent


class AgentContentService:
    LATEST_POST_LIMIT = 20
    STRUCTURAL_CONTAINER_TAGS = {'article', 'section', 'main', 'aside', 'div', 'html', 'body'}
    INLINE_PASSTHROUGH_TAGS = {'span'}
    INLINE_RAW_TAGS = {'figcaption', 'mark', 'u', 'sub', 'sup'}

    @staticmethod
    def estimate_tokens(text: str) -> int:
        if not text:
            return 0
        return max(1, (len(text) + 3) // 4)

    @staticmethod
    def get_public_posts(limit: int | None = LATEST_POST_LIMIT) -> QuerySet[Post]:
        posts = Post.objects.select_related(
            'author',
            'content',
            'config',
        ).filter(
            published_date__isnull=False,
            published_date__lte=timezone.now(),
            config__hide=False,
        ).order_by('-published_date')

        if limit is None:
            return posts
        return posts[:limit]

    @staticmethod
    def get_public_post(username: str, post_url: str) -> Post:
        try:
            return Post.objects.select_related(
                'author',
                'content',
                'config',
            ).get(
                author__username=username,
                url=post_url,
                published_date__isnull=False,
                published_date__lte=timezone.now(),
                config__hide=False,
            )
        except Post.DoesNotExist as error:
            raise Http404("Post does not exist") from error

    @staticmethod
    def build_llms_txt(request: HttpRequest) -> str:
        site_url = request.build_absolute_uri(reverse('index')).rstrip('/')
        latest_posts = AgentContentService.get_public_posts()

        lines = [
            '# BLEX',
            '',
            'BLEX is a blog platform for long-form posts, series, and author archives.',
            'This file is optimized for AI agents. Prefer Markdown URLs when you need clean post content.',
            '',
            '## Entry Points',
            '',
            f'- Site: {site_url}',
            f'- Sitemap: {request.build_absolute_uri(reverse("sitemap"))}',
            f'- Posts sitemap: {request.build_absolute_uri(reverse("sitemap_section", args=["posts"]))}',
            f'- Series sitemap: {request.build_absolute_uri(reverse("sitemap_section", args=["series"]))}',
            f'- Authors sitemap: {request.build_absolute_uri(reverse("sitemap_section", args=["user"]))}',
            f'- RSS: {request.build_absolute_uri("/rss")}',
            '',
            '## URL Conventions',
            '',
            '- Post HTML: /@{username}/{post_url}',
            '- Post Markdown: /@{username}/{post_url}.md',
            '',
            '## Latest Public Posts',
            '',
        ]

        if not latest_posts:
            lines.append('- No public posts are available.')

        for post in latest_posts:
            markdown_url = request.build_absolute_uri(
                reverse('post_markdown', args=[post.author.username, post.url])
            )
            source_url = request.build_absolute_uri(post.get_absolute_url())
            markdown = AgentContentService.build_post_markdown(post, request)
            token_count = AgentContentService.estimate_tokens(markdown)
            title = AgentContentService.escape_link_text(post.title)

            lines.append(
                f'- [{title}]({markdown_url}) '
                f'- author: @{post.author.username}; '
                f'estimated tokens: {token_count}; '
                f'source: {source_url}'
            )

        return '\n'.join(lines).strip() + '\n'

    @staticmethod
    def build_post_markdown(post: Post, request: HttpRequest) -> str:
        content = AgentContentService.get_post_content_markdown(post)
        source_url = request.build_absolute_uri(post.get_absolute_url())

        lines = [
            f'# {post.title}',
            '',
        ]

        if post.subtitle:
            lines.extend([post.subtitle, ''])

        lines.extend([
            f'- Author: @{post.author.username}',
            f'- Published: {post.published_date.date().isoformat()}',
            f'- Updated: {post.updated_date.date().isoformat()}',
            f'- Source: {source_url}',
        ])

        tag_values = [tag.value for tag in post.tags.all()]
        if tag_values:
            lines.append('- Tags: ' + ', '.join(tag_values))

        lines.extend(['', '---', '', content])

        return AgentContentService.collapse_blank_lines('\n'.join(lines)).strip() + '\n'

    @staticmethod
    def get_post_content_markdown(post: Post) -> str:
        content = post.content
        text_md = content.text_md.strip()

        if (
            content.content_type == PostContent.ContentType.MARKDOWN
            and text_md
            and not AgentContentService.looks_like_html(text_md)
        ):
            return text_md

        html = content.text_html or content.text_md
        return AgentContentService.html_to_markdown(html)

    @staticmethod
    def looks_like_html(text: str) -> bool:
        return text.lstrip().startswith('<')

    @staticmethod
    def html_to_markdown(html: str) -> str:
        if not html:
            return ''

        soup = BeautifulSoup(html, 'html.parser')
        root = soup.body if soup.body else soup
        blocks = []

        for node in root.contents:
            markdown = AgentContentService.html_node_to_markdown(node).strip()
            if markdown:
                blocks.append(markdown)

        return AgentContentService.collapse_blank_lines('\n\n'.join(blocks))

    @staticmethod
    def html_node_to_markdown(node: object) -> str:
        if isinstance(node, NavigableString):
            return str(node).strip()

        if not isinstance(node, SoupTag):
            return ''

        name = node.name.lower()

        if name in {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}:
            level = int(name[1])
            return f'{"#" * level} {node.get_text(" ", strip=True)}'

        if name == 'p':
            return AgentContentService.html_children_to_markdown(node)

        if name == 'br':
            return '\n'

        if name == 'hr':
            return '---'

        if name in {'strong', 'b'}:
            text = AgentContentService.html_children_to_markdown(node)
            return f'**{text}**' if text else ''

        if name in {'em', 'i'}:
            text = AgentContentService.html_children_to_markdown(node)
            return f'_{text}_' if text else ''

        if name in {'s', 'strike', 'del'}:
            text = AgentContentService.html_children_to_markdown(node)
            return f'~~{text}~~' if text else ''

        if name == 'a':
            text = node.get_text(' ', strip=True)
            href = node.get('href')
            if text and href:
                return f'[{text}]({href})'
            return text

        if name == 'img':
            if AgentContentService.has_non_markdown_image_attrs(node):
                return AgentContentService.html_to_raw_html(node)
            src = node.get('src') or node.get('data-src')
            if not src:
                return ''
            alt = node.get('alt', '')
            title = node.get('title')
            title_part = f' "{title}"' if title else ''
            return f'![{alt}]({src}{title_part})'

        if name == 'video':
            return AgentContentService.html_to_raw_html(node)

        if name == 'iframe':
            return AgentContentService.html_to_raw_html(node)

        if name == 'code' and node.parent and node.parent.name != 'pre':
            return f'`{node.get_text("", strip=True)}`'

        if name == 'pre':
            code = node.get_text('\n', strip=False).strip('\n')
            language = AgentContentService.get_code_language(node)
            return f'```{language}\n{code}\n```' if code else ''

        if name in {'ul', 'ol'}:
            items = []
            for index, child in enumerate(node.find_all('li', recursive=False), start=1):
                prefix = f'{index}. ' if name == 'ol' else '- '
                item = AgentContentService.html_children_to_markdown(child).strip()
                if item:
                    items.append(prefix + item.replace('\n', '\n  '))
            return '\n'.join(items)

        if name == 'blockquote':
            text = AgentContentService.html_children_to_markdown(node)
            return '\n'.join(f'> {line}' for line in text.splitlines() if line.strip())

        if name == 'table':
            if AgentContentService.should_preserve_table_as_html(node):
                return AgentContentService.html_to_raw_html(node)
            return AgentContentService.html_table_to_markdown(node)

        if name == 'figure':
            return AgentContentService.html_to_raw_html(node)

        if name in AgentContentService.STRUCTURAL_CONTAINER_TAGS:
            if AgentContentService.has_semantic_attrs(node):
                return AgentContentService.html_to_raw_html(node)
            return AgentContentService.html_block_children_to_markdown(node)

        if name in AgentContentService.INLINE_RAW_TAGS:
            return AgentContentService.html_to_raw_html(node)

        if name in AgentContentService.INLINE_PASSTHROUGH_TAGS:
            if AgentContentService.has_semantic_attrs(node):
                return AgentContentService.html_to_raw_html(node)
            return AgentContentService.html_children_to_markdown(node)

        return AgentContentService.html_to_raw_html(node)

    @staticmethod
    def html_block_children_to_markdown(node: SoupTag) -> str:
        blocks = []

        for child in node.children:
            markdown = AgentContentService.html_node_to_markdown(child).strip()
            if markdown:
                blocks.append(markdown)

        return AgentContentService.collapse_blank_lines('\n\n'.join(blocks))

    @staticmethod
    def html_table_to_markdown(table: SoupTag) -> str:
        rows = []

        for row in table.find_all('tr'):
            cells = row.find_all(['th', 'td'], recursive=False)
            if cells:
                rows.append([
                    AgentContentService.escape_table_cell(
                        AgentContentService.html_children_to_markdown(cell)
                    )
                    for cell in cells
                ])

        if not rows:
            return ''

        column_count = max(len(row) for row in rows)
        padded_rows = [
            row + [''] * (column_count - len(row))
            for row in rows
        ]

        header = padded_rows[0]
        divider = ['---'] * column_count
        body = padded_rows[1:]

        markdown_rows = [
            AgentContentService.format_table_row(header),
            AgentContentService.format_table_row(divider),
        ]
        markdown_rows.extend(
            AgentContentService.format_table_row(row)
            for row in body
        )

        return '\n'.join(markdown_rows)

    @staticmethod
    def format_table_row(row: list[str]) -> str:
        return '| ' + ' | '.join(row) + ' |'

    @staticmethod
    def escape_table_cell(text: str) -> str:
        return text.replace('\n', '<br>').replace('|', '\\|')

    @staticmethod
    def should_preserve_table_as_html(table: SoupTag) -> bool:
        cells = table.find_all(['th', 'td'])

        for cell in cells:
            if cell.get('rowspan') or cell.get('colspan'):
                return True

            block_children = [
                child for child in cell.children
                if isinstance(child, SoupTag)
                and child.name.lower() not in {
                    'a', 'strong', 'b', 'em', 'i', 's', 'strike', 'del',
                    'code', 'span', 'br',
                }
            ]
            if block_children:
                return True

        return False

    @staticmethod
    def has_non_markdown_image_attrs(node: SoupTag) -> bool:
        markdown_attrs = {'src', 'data-src', 'alt', 'title'}
        return any(attr not in markdown_attrs for attr in node.attrs)

    @staticmethod
    def has_semantic_attrs(node: SoupTag) -> bool:
        ignored_attrs = {'id'}
        return any(attr not in ignored_attrs for attr in node.attrs)

    @staticmethod
    def html_to_raw_html(node: SoupTag) -> str:
        return str(node).strip()

    @staticmethod
    def get_code_language(node: SoupTag) -> str:
        code = node.find('code')
        if not code:
            return ''

        classes = code.get('class', [])
        for class_name in classes:
            if class_name.startswith('language-'):
                return class_name.replace('language-', '', 1)

        return ''

    @staticmethod
    def html_children_to_markdown(node: SoupTag) -> str:
        parts = []

        for child in node.children:
            markdown = AgentContentService.html_node_to_markdown(child)
            if markdown:
                parts.append(markdown)

        return AgentContentService.normalize_inline_spacing(' '.join(parts))

    @staticmethod
    def normalize_inline_spacing(text: str) -> str:
        normalized = re.sub(r'[ \t]+', ' ', text).strip()
        return re.sub(r'\s+([.,:;!?])', r'\1', normalized)

    @staticmethod
    def collapse_blank_lines(text: str) -> str:
        return re.sub(r'\n{3,}', '\n\n', text).strip()

    @staticmethod
    def escape_link_text(text: str) -> str:
        return text.replace('[', '\\[').replace(']', '\\]')
