"""
Banner Service
Handles business logic for both user banners and global banners
"""
from typing import List, Dict
from django.contrib.auth.models import User
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils.safestring import SafeString, mark_safe

from board.html_utils import safe_navigation_url, sanitize_html
from board.models import SiteBanner, SiteContentScope
from board.models.site import BannerTemplate, BannerTone


class BannerService:
    """Service for managing and displaying banners"""

    TEMPLATE_PATHS = {
        BannerTemplate.NOTICE: 'components/banners/notice.html',
        BannerTemplate.CARD: 'components/banners/card.html',
        BannerTemplate.INTRO: 'components/banners/intro.html',
    }

    @staticmethod
    def render_banner_html(banner: SiteBanner) -> SafeString:
        """Render a banner for post pages and the settings preview with the same rules."""
        template_path = BannerService.TEMPLATE_PATHS.get(banner.template)
        if template_path is None:
            if banner.scope == SiteContentScope.USER:
                return mark_safe(sanitize_html(banner.content_html))
            return mark_safe(banner.content_html)

        return render_to_string(template_path, {
            'banner': banner,
            'link_url': safe_navigation_url(banner.link_url),
            'is_emphasis': banner.tone == BannerTone.EMPHASIS,
        })

    @staticmethod
    def get_combined_banners_for_position(
        author: User,
        banner_type: str,
        position: str
    ) -> List[SiteBanner]:
        """
        Combine user banners and global banners for a specific position.

        Args:
            author: The post author (User instance)
            banner_type: Banner type ('horizontal' or 'sidebar')
            position: Banner position ('top', 'bottom', 'left', 'right')

        Returns:
            List of combined banners sorted by order and created_date
        """
        banners = list(
            SiteBanner.objects.filter(
                is_active=True,
                banner_type=banner_type,
                position=position,
            ).filter(
                Q(scope=SiteContentScope.GLOBAL) |
                Q(scope=SiteContentScope.USER, user=author)
            ).select_related('user').order_by('order', '-created_date')
        )
        for banner in banners:
            if banner.scope == SiteContentScope.USER:
                banner.content_html = sanitize_html(banner.content_html)
        return banners

    @staticmethod
    def get_all_banners_for_author(author: User) -> Dict[str, List[SiteBanner]]:
        """
        Get all active banners for a post author, including global banners.

        Args:
            author: The post author (User instance)

        Returns:
            Dictionary with banner positions as keys:
            {
                'top': [banner1, banner2, ...],
                'bottom': [...],
                'left': [...],
                'right': [...]
            }
        """
        banners = SiteBanner.objects.filter(
            is_active=True,
        ).filter(
            Q(scope=SiteContentScope.GLOBAL) |
            Q(scope=SiteContentScope.USER, user=author)
        ).select_related('user').order_by('order', '-created_date')

        result = {
            'top': [],
            'bottom': [],
            'left': [],
            'right': []
        }

        for banner in banners:
            if banner.position in result:
                banner.rendered_html = BannerService.render_banner_html(banner)
                result[banner.position].append(banner)

        return result
