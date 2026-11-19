from __future__ import annotations

import logging
import secrets
from datetime import timedelta
from typing import TypedDict

from django.db import DatabaseError, connection
from django.db.models import Q, QuerySet, Sum
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone

from board.models import Post, PostShareLink, User
from board.services.public_post_service import PublicPostService
from board.services.site_url_service import SiteUrlService


logger = logging.getLogger(__name__)


class PostShareLinkSummary(TypedDict):
    id: int
    label: str
    url: str
    is_paused: bool
    recent_clicks: int
    total_clicks: int


class PostShareLinkService:
    LABEL_LIMIT = PostShareLink._meta.get_field('label').max_length
    TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstvwxyz'
    TOKEN_LENGTH = 6
    TOKEN_ATTEMPTS = 5
    PREVIEW_AGENTS = (
        'facebookexternalhit',
        'facebot',
        'discordbot',
        'slackbot',
        'telegrambot',
        'twitterbot',
        'linkedinbot',
        'kakaotalk-scrap',
        'skypeuripreview',
        'googlebot',
        'bingbot',
        'applebot',
        'yeti',
    )

    @staticmethod
    def managed_posts(author: User, username: str) -> QuerySet[Post]:
        return Post.objects.filter(
            author=author,
            author__username=username,
            published_date__isnull=False,
        )

    @staticmethod
    def can_create(post: Post) -> bool:
        return PublicPostService.filter_public_posts(Post.objects.filter(pk=post.pk)).exists()

    @classmethod
    def clean_label(cls, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        label = value.strip()
        if not label or len(label) > cls.LABEL_LIMIT:
            return None
        return label

    @classmethod
    def generate_token(cls) -> str:
        return ''.join(secrets.choice(cls.TOKEN_ALPHABET) for _ in range(cls.TOKEN_LENGTH))

    @classmethod
    def create(cls, post: Post, label: str) -> PostShareLink:
        for _ in range(cls.TOKEN_ATTEMPTS):
            link, created = PostShareLink.objects.get_or_create(
                token=cls.generate_token(),
                defaults={'post': post, 'label': label},
            )
            if created:
                return link
        raise RuntimeError('Could not allocate a unique post share link token.')

    @staticmethod
    def update(link: PostShareLink, *, label: str | None, is_paused: bool | None) -> None:
        changes: dict[str, str | bool] = {}
        if label is not None:
            changes['label'] = label
        if is_paused is not None:
            changes['is_paused'] = is_paused
        PostShareLink.objects.filter(pk=link.pk).update(**changes)

    @staticmethod
    def summaries(post: Post, request: HttpRequest) -> list[PostShareLinkSummary]:
        today = timezone.localdate()
        start_day = today - timedelta(days=6)
        links = post.share_links.annotate(
            recent_clicks=Sum(
                'daily_counts__clicks',
                filter=Q(daily_counts__day__range=(start_day, today)),
                default=0,
            ),
            total_clicks=Sum('daily_counts__clicks', default=0),
        ).order_by('-created_date', '-id')
        return [
            {
                'id': link.pk,
                'label': link.label,
                'url': SiteUrlService.absolute_url(
                    request, reverse('post_share_link_redirect', kwargs={'token': link.token}),
                ),
                'is_paused': link.is_paused,
                'recent_clicks': link.recent_clicks,
                'total_clicks': link.total_clicks,
            }
            for link in links
        ]

    @staticmethod
    def get_public_link(token: str) -> PostShareLink | None:
        return PostShareLink.objects.filter(
            PublicPostService.build_public_filter('post'),
            token=token,
            is_paused=False,
        ).select_related('post__author').only(
            'id', 'post__url', 'post__author__username',
        ).first()

    @classmethod
    def record_click(cls, link: PostShareLink, request: HttpRequest) -> None:
        if request.method != 'GET':
            return
        purposes = (
            request.headers.get('Sec-Purpose', ''),
            request.headers.get('Purpose', ''),
        )
        if any('prefetch' in purpose.lower() for purpose in purposes):
            return
        user_agent = request.headers.get('User-Agent', '').lower()
        if any(agent in user_agent for agent in cls.PREVIEW_AGENTS):
            return

        try:
            # One statement handles concurrent clicks and the first click of the day.
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO board_post_share_link_daily_counts (link_id, day, clicks)
                    VALUES (%s, %s, 1)
                    ON CONFLICT (link_id, day) DO UPDATE SET clicks = clicks + 1
                    """,
                    [link.pk, timezone.localdate()],
                )
        except DatabaseError:
            logger.warning('Could not count click for post share link %s.', link.pk, exc_info=True)
