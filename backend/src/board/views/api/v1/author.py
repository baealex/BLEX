from datetime import timedelta
from collections import defaultdict

from django.db.models import Count, F
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.cache import cache

from board.models import User, Post, Comment, PostLikes
from board.services import UserService
from board.services.public_post_service import PublicPostService
from board.modules.response import StatusDone, StatusError, ErrorCode


def get_author_heatmap(request, username):
    """
    API endpoint for author heatmap
    Returns heatmap data for the specified author for the last year
    """
    if request.method != 'GET':
        return StatusError(ErrorCode.INVALID_REQUEST)

    user = get_object_or_404(User, username=username)

    # Try to get from cache first (cache for 1 hour)
    cache_key = f'author_heatmap_{user.id}'
    heatmap = cache.get(cache_key)

    if heatmap is None:
        # Generate heatmap data for the last year
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=365)

        # Aggregate each activity type in the database, then fetch the three
        # result sets with one UNION ALL query.  Keeping UNION ALL is important:
        # activity counts from different sources on the same day must be added.
        posts = Post.objects.filter(
            PublicPostService.build_public_filter(),
            author=user,
            published_date__date__gte=start_date,
            published_date__date__lte=end_date,
        ).annotate(
            activity_date=F('published_date__date'),
        ).values('activity_date').annotate(count=Count('id')).order_by()
        comments = Comment.objects.filter(
            PublicPostService.build_public_filter('post'),
            author=user,
            created_date__date__gte=start_date,
            created_date__date__lte=end_date,
        ).annotate(
            activity_date=F('created_date__date'),
        ).values('activity_date').annotate(count=Count('id')).order_by()
        likes = PostLikes.objects.filter(
            PublicPostService.build_public_filter('post'),
            user=user,
            created_date__date__gte=start_date,
            created_date__date__lte=end_date,
        ).annotate(
            activity_date=F('created_date__date'),
        ).values('activity_date').annotate(count=Count('id')).order_by()

        heatmap = defaultdict(int)
        for activity in posts.union(comments, likes, all=True):
            date_str = activity['activity_date'].strftime('%Y-%m-%d')
            heatmap[date_str] += activity['count']

        # Convert to dict and cache
        heatmap = dict(heatmap)
        cache.set(cache_key, heatmap, 3600)

    return StatusDone(heatmap)
