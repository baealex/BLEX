from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.core.cache import cache

from board.services import UserService
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

    stats = UserService.get_user_dashboard_stats(request.user)

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
        return StatusDone({'recentActivities': cached_activities})

    recent_activities = UserService.get_user_dashboard_activities(request.user, days=30)

    # Cache the results for 2 minutes
    cache.set(cache_key, recent_activities, 120)

    return StatusDone({'recentActivities': recent_activities})