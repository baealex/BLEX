from datetime import timedelta
from collections import defaultdict

from django.db.models import Count
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.core.cache import cache

from board.models import User, Post, Comment, PostLikes
from board.services import UserService
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

        # Initialize heatmap
        heatmap = defaultdict(int)

        # Fetch posts
        posts = Post.objects.filter(
            author=user,
            created_date__date__gte=start_date,
            created_date__date__lte=end_date,
            config__hide=False
        ).values('created_date__date').annotate(count=Count('id'))

        for post in posts:
            date_str = post['created_date__date'].strftime('%Y-%m-%d')
            heatmap[date_str] += post['count']

        # Fetch comments
        comments = Comment.objects.filter(
            author=user,
            created_date__date__gte=start_date,
            created_date__date__lte=end_date,
            post__config__hide=False
        ).values('created_date__date').annotate(count=Count('id'))

        for comment in comments:
            date_str = comment['created_date__date'].strftime('%Y-%m-%d')
            heatmap[date_str] += comment['count']

        # Fetch likes
        likes = PostLikes.objects.filter(
            user=user,
            created_date__date__gte=start_date,
            created_date__date__lte=end_date,
            post__config__hide=False
        ).values('created_date__date').annotate(count=Count('id'))

        for like in likes:
            date_str = like['created_date__date'].strftime('%Y-%m-%d')
            heatmap[date_str] += like['count']

        # Convert to dict and cache
        heatmap = dict(heatmap)
        cache.set(cache_key, heatmap, 3600)

    return StatusDone(heatmap)
