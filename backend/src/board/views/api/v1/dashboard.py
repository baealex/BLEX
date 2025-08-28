from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.db.models import F, Count, Sum, Q, Subquery, OuterRef
from django.utils import timezone
from django.core.cache import cache

from board.models import Post, PostAnalytics, Comment, PostLikes
from board.modules.response import StatusDone, StatusError, ErrorCode


@login_required
def dashboard_stats(request):
    """
    API endpoint for dashboard statistics
    Returns total posts, views, likes, and comments for the authenticated user
    Optimized version with single query and caching
    """
    if request.method != 'GET':
        raise Http404

    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN)

    # Try to get from cache first (cache for 5 minutes)
    cache_key = f'dashboard_stats_{request.user.id}'
    cached_stats = cache.get(cache_key)
    if cached_stats:
        return StatusDone(cached_stats)

    # Single optimized query to get all stats at once
    stats_query = Post.objects.filter(
        author=request.user,
        created_date__lte=timezone.now(),
    ).aggregate(
        total_posts=Count('id'),
        total_likes=Count('likes', distinct=True),
        total_comments=Count('comments', distinct=True),
    )
    
    # Separate optimized query for views (most expensive operation)
    # Count devices per PostAnalytics record, then sum them (like Post.total() method)
    total_views = PostAnalytics.objects.filter(
        post__author=request.user
    ).annotate(
        device_count=Count('devices')
    ).aggregate(
        total_views=Sum('device_count')
    )['total_views'] or 0
    
    stats = {
        'total_posts': stats_query['total_posts'] or 0,
        'total_views': total_views,
        'total_likes': stats_query['total_likes'] or 0,
        'total_comments': stats_query['total_comments'] or 0,
    }
    
    # Cache the results for 5 minutes
    cache.set(cache_key, stats, 300)
    
    return StatusDone(stats)


@login_required
def dashboard_activities(request):
    """
    API endpoint for dashboard recent activities
    Returns recent posts, comments, and likes for the authenticated user
    Optimized version with caching and efficient queries
    """
    if request.method != 'GET':
        raise Http404

    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN)

    # Try to get from cache first (cache for 2 minutes)
    cache_key = f'dashboard_activities_{request.user.id}'
    cached_activities = cache.get(cache_key)
    if cached_activities:
        return StatusDone({'recent_activities': cached_activities})

    from itertools import chain
    from operator import attrgetter
    
    # Use timezone cutoff for better indexing
    cutoff_date = timezone.now() - timezone.timedelta(days=30)  # Only look at last 30 days
    
    # Optimized queries with proper select_related and limited date range
    recent_posts = Post.objects.filter(
        author=request.user,
        created_date__gte=cutoff_date,
        created_date__lte=timezone.now(),
    ).only('title', 'created_date').order_by('-created_date')[:5]
    
    recent_comments = Comment.objects.filter(
        author=request.user,
        created_date__gte=cutoff_date,
    ).select_related('post').only(
        'created_date', 'post__title'
    ).order_by('-created_date')[:5]
    
    recent_likes = PostLikes.objects.filter(
        user=request.user,
        created_date__gte=cutoff_date,
    ).select_related('post').only(
        'created_date', 'post__title'
    ).order_by('-created_date')[:5]
    
    # Convert to activities list efficiently
    activities = []
    
    # Add posts
    for post in recent_posts:
        activities.append({
            'type': 'post',
            'title': post.title,
            'date': post.time_since(),
            'sort_date': post.created_date,
        })
    
    # Add comments
    for comment in recent_comments:
        activities.append({
            'type': 'comment',
            'post_title': comment.post.title,
            'date': comment.time_since(),
            'sort_date': comment.created_date,
        })
    
    # Add likes
    for like in recent_likes:
        activities.append({
            'type': 'like',
            'post_title': like.post.title,
            'date': like.time_since() if hasattr(like, 'time_since') else like.created_date.strftime('%Y-%m-%d'),
            'sort_date': like.created_date,
        })
    
    # Sort by actual datetime and limit to 5
    recent_activities = sorted(activities, key=lambda x: x['sort_date'], reverse=True)[:5]
    
    # Remove sort_date from final output
    for activity in recent_activities:
        del activity['sort_date']
    
    # Cache the results for 2 minutes
    cache.set(cache_key, recent_activities, 120)
    
    return StatusDone({'recent_activities': recent_activities})