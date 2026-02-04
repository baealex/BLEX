"""
Banner Service
Handles business logic for both user banners and global banners
"""
from itertools import chain
from typing import List, Union, Dict
from django.contrib.auth.models import User

from board.models import Banner, GlobalBanner, BannerType, BannerPosition


class BannerService:
    """Service for managing and displaying banners"""

    @staticmethod
    def get_combined_banners_for_position(
        author: User,
        banner_type: str,
        position: str
    ) -> List[Union[Banner, GlobalBanner]]:
        """
        Combine user banners and global banners for a specific position.

        Args:
            author: The post author (User instance)
            banner_type: Banner type ('horizontal' or 'sidebar')
            position: Banner position ('top', 'bottom', 'left', 'right')

        Returns:
            List of combined banners sorted by order and created_date
        """
        # Fetch user's personal banners with related user data
        user_banners = Banner.objects.filter(
            user=author,
            is_active=True,
            banner_type=banner_type,
            position=position
        ).select_related('user')

        # Fetch global (site-wide) banners with related created_by data
        global_banners = GlobalBanner.objects.filter(
            is_active=True,
            banner_type=banner_type,
            position=position
        ).select_related('created_by')

        # Combine and sort by order (ascending), then created_date (descending)
        combined = list(chain(user_banners, global_banners))
        combined.sort(key=lambda x: (x.order, -x.created_date.timestamp()))

        return combined

    @staticmethod
    def get_all_banners_for_author(author: User) -> Dict[str, List[Union[Banner, GlobalBanner]]]:
        """
        Get all active banners for a post author, including global banners.

        Optimized to fetch all banners in just 2 queries instead of 8.

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
        user_banners = Banner.objects.filter(
            user=author,
            is_active=True
        ).select_related('user')

        global_banners = GlobalBanner.objects.filter(
            is_active=True
        ).select_related('created_by')

        combined = list(chain(user_banners, global_banners))
        combined.sort(key=lambda x: (x.order, -x.created_date.timestamp()))

        result = {
            'top': [],
            'bottom': [],
            'left': [],
            'right': []
        }

        for banner in combined:
            if banner.position in result:
                result[banner.position].append(banner)

        return result
