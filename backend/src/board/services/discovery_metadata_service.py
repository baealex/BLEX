import json
import re
from urllib.parse import urlencode

from django.contrib.auth.models import User
from django.http import HttpRequest
from django.urls import reverse
from django.utils.html import strip_tags
from django.utils.text import Truncator

from board.models import Post, Series, StaticPage


class DiscoveryMetadataService:
    @staticmethod
    def build_series_metadata(
        series: Series,
        author: User,
        request: HttpRequest,
        posts: list[Post],
        total_posts: int,
        page: int,
        sort_order: str,
    ) -> dict[str, str]:
        canonical_url = DiscoveryMetadataService.build_series_canonical_url(
            series=series,
            author=author,
            request=request,
            page=page,
            sort_order=sort_order,
        )
        meta_description = DiscoveryMetadataService.build_meta_description(
            raw_text=series.text_html or series.text_md,
            fallback=f'{author.username}의 BLEX 시리즈 {series.name}',
        )

        return {
            'canonical_url': canonical_url,
            'meta_description': meta_description,
            'seo_title': f'{series.name} - {author.username} | BLEX',
            'structured_data_json': DiscoveryMetadataService.build_series_structured_data(
                series=series,
                author=author,
                request=request,
                posts=posts,
                total_posts=total_posts,
                sort_order=sort_order,
                canonical_url=canonical_url,
                meta_description=meta_description,
            ),
        }

    @staticmethod
    def build_static_page_metadata(page: StaticPage, request: HttpRequest) -> dict[str, str]:
        canonical_url = request.build_absolute_uri(
            reverse('static_page', kwargs={'slug': page.slug})
        )
        meta_description = DiscoveryMetadataService.build_meta_description(
            raw_text=page.meta_description or page.content,
            fallback=page.title,
        )

        return {
            'canonical_url': canonical_url,
            'meta_description': meta_description,
            'seo_title': f'{page.title} - BLEX',
            'structured_data_json': DiscoveryMetadataService.build_static_page_structured_data(
                page=page,
                request=request,
                canonical_url=canonical_url,
                meta_description=meta_description,
            ),
        }

    @staticmethod
    def build_meta_description(raw_text: str, fallback: str) -> str:
        clean_text = DiscoveryMetadataService.normalize_text(raw_text)
        source_text = clean_text or fallback
        return Truncator(source_text).chars(160)

    @staticmethod
    def build_series_canonical_url(
        series: Series,
        author: User,
        request: HttpRequest,
        page: int,
        sort_order: str,
    ) -> str:
        base_url = request.build_absolute_uri(
            reverse(
                'series_detail',
                kwargs={
                    'username': author.username,
                    'series_url': series.url,
                },
            )
        )

        query_items: list[tuple[str, str]] = []
        if sort_order == 'asc':
            query_items.append(('sort', 'asc'))
        if page > 1:
            query_items.append(('page', str(page)))

        if not query_items:
            return base_url

        return f'{base_url}?{urlencode(query_items)}'

    @staticmethod
    def build_series_structured_data(
        series: Series,
        author: User,
        request: HttpRequest,
        posts: list[Post],
        total_posts: int,
        sort_order: str,
        canonical_url: str,
        meta_description: str,
    ) -> str:
        author_url = request.build_absolute_uri(
            reverse('user_profile', kwargs={'username': author.username})
        )
        site_url = request.build_absolute_uri(reverse('index'))

        item_list_elements = []
        for position, post in enumerate(posts, start=1):
            post_url = request.build_absolute_uri(
                reverse(
                    'post_detail',
                    kwargs={
                        'username': author.username,
                        'post_url': post.url,
                    },
                )
            )
            item_list_elements.append(
                {
                    '@type': 'ListItem',
                    'position': position,
                    'item': {
                        '@type': 'BlogPosting',
                        'headline': post.title,
                        'description': post.meta_description or post.title,
                        'url': post_url,
                        'datePublished': post.published_date.isoformat() if post.published_date else None,
                        'author': {
                            '@type': 'Person',
                            'name': author.username,
                            'url': author_url,
                        },
                    },
                }
            )

        payload = {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            'name': series.name,
            'headline': series.name,
            'description': meta_description,
            'url': canonical_url,
            'author': {
                '@type': 'Person',
                'name': author.username,
                'url': author_url,
            },
            'isPartOf': {
                '@type': 'WebSite',
                'name': 'BLEX',
                'url': site_url,
            },
            'mainEntity': {
                '@type': 'ItemList',
                'itemListOrder': (
                    'https://schema.org/ItemListOrderDescending'
                    if sort_order == 'desc'
                    else 'https://schema.org/ItemListOrderAscending'
                ),
                'numberOfItems': total_posts,
                'itemListElement': item_list_elements,
            },
            'dateModified': series.updated_date.isoformat(),
        }

        return json.dumps(payload, ensure_ascii=False, separators=(',', ':'))

    @staticmethod
    def build_static_page_structured_data(
        page: StaticPage,
        request: HttpRequest,
        canonical_url: str,
        meta_description: str,
    ) -> str:
        payload = {
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            'name': page.title,
            'headline': page.title,
            'description': meta_description,
            'url': canonical_url,
            'datePublished': page.created_date.isoformat(),
            'dateModified': page.updated_date.isoformat(),
            'isPartOf': {
                '@type': 'WebSite',
                'name': 'BLEX',
                'url': request.build_absolute_uri(reverse('index')),
            },
        }

        if page.author:
            payload['author'] = {
                '@type': 'Person',
                'name': page.author.username,
                'url': request.build_absolute_uri(
                    reverse('user_profile', kwargs={'username': page.author.username})
                ),
            }

        return json.dumps(payload, ensure_ascii=False, separators=(',', ':'))

    @staticmethod
    def normalize_text(raw_text: str) -> str:
        if not raw_text:
            return ''

        stripped_text = re.sub(r'<[^>]+>', ' ', raw_text)
        stripped_text = strip_tags(stripped_text)
        return ' '.join(stripped_text.split())
