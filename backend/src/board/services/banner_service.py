"""
Banner Service
Handles business logic for both user banners and global banners
"""
from typing import List, Dict
from django.contrib.auth.models import User
from django.db.models import Q

from board.models import SiteBanner, SiteContentScope, BannerType, BannerPosition


class BannerService:
    """Service for managing and displaying banners"""

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
        return list(
            SiteBanner.objects.filter(
                is_active=True,
                banner_type=banner_type,
                position=position,
            ).filter(
                Q(scope=SiteContentScope.GLOBAL) |
                Q(scope=SiteContentScope.USER, user=author)
            ).select_related('user').order_by('order', '-created_date')
        )

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
                result[banner.position].append(banner)

        return result
