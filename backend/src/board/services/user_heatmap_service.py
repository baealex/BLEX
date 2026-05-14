from collections import defaultdict
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db.models import Count
from django.utils import timezone

from board.models import Comment, Post, PostLikes


class UserHeatmapService:
    """Build and cache private user activity heatmap data for settings."""

    CACHE_KEY_TEMPLATE = 'user_heatmap_{user_id}'
    CACHE_TTL_SECONDS = 3600
    WINDOW_DAYS = 365

    @staticmethod
    def get_settings_heatmap(user: User) -> dict[str, int]:
        cache_key = UserHeatmapService.CACHE_KEY_TEMPLATE.format(user_id=user.id)
        heatmap = cache.get(cache_key)

        if heatmap is not None:
            return heatmap

        heatmap = UserHeatmapService.build_settings_heatmap(user)
        cache.set(cache_key, heatmap, UserHeatmapService.CACHE_TTL_SECONDS)
        return heatmap

    @staticmethod
    def build_settings_heatmap(user: User) -> dict[str, int]:
        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=UserHeatmapService.WINDOW_DAYS)
        heatmap = defaultdict(int)

        UserHeatmapService.add_daily_counts(
            heatmap,
            Post.objects.filter(
                author=user,
                published_date__date__gte=start_date,
                published_date__date__lte=end_date,
            ).values('published_date__date').annotate(count=Count('id')),
            'published_date__date',
        )
        UserHeatmapService.add_daily_counts(
            heatmap,
            Comment.objects.filter(
                author=user,
                created_date__date__gte=start_date,
                created_date__date__lte=end_date,
            ).values('created_date__date').annotate(count=Count('id')),
            'created_date__date',
        )
        UserHeatmapService.add_daily_counts(
            heatmap,
            PostLikes.objects.filter(
                user=user,
                created_date__date__gte=start_date,
                created_date__date__lte=end_date,
            ).values('created_date__date').annotate(count=Count('id')),
            'created_date__date',
        )

        return dict(heatmap)

    @staticmethod
    def add_daily_counts(heatmap, rows, date_field: str) -> None:
        for row in rows:
            date_str = row[date_field].strftime('%Y-%m-%d')
            heatmap[date_str] += row['count']
