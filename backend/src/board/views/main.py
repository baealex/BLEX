from django.shortcuts import render
from django.utils import timezone
from django.db.models import F, Count, Exists, OuterRef, Sum
from django.contrib.auth.decorators import login_required

from board.models import Post, PostLikes, Comment, PostAnalytics
from board.modules.paginator import Paginator


def index(request):
    """
    Main page view that renders the homepage with newest posts.
    This replaces the frontend React component with a Django template.
    """
    # Get posts with the same annotations as the API endpoint
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        created_date__lte=timezone.now(),
        config__notice=False,
        config__hide=False,
    ).annotate(
        author_username=F('author__username'),
        author_image=F('author__profile__avatar'),
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
        has_liked=Exists(
            PostLikes.objects.filter(
                post__id=OuterRef('id'),
                user__id=request.user.id if request.user.id else -1
            )
        ),
    ).order_by('-created_date')

    # Paginate the results
    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )
    
    # Format dates and prepare context
    for post in paginated_posts:
        post.created_date = post.time_since()
    
    context = {
        'posts': paginated_posts,
        'page_number': page,
        'page_count': paginated_posts.paginator.num_pages,
    }
    
    return render(request, 'board/index.html', context)


@login_required
def dashboard(request):
    """
    Dashboard view that shows user's blog statistics, recent posts, and activities.
    Requires user to be logged in.
    """
    # Get user's posts
    user_posts = Post.objects.filter(
        author=request.user,
        created_date__lte=timezone.now(),
    ).annotate(
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
    )
    
    # Get recent posts (last 4)
    recent_posts = user_posts.order_by('-created_date')[:4]
    
    # Format dates for recent posts
    for post in recent_posts:
        post.created_date = post.time_since()
    
    # Calculate statistics
    total_posts = user_posts.count()
    total_views = PostAnalytics.objects.filter(
        post__author=request.user
    ).annotate(
        table_count=Count('devices'),
    ).aggregate(sum=Sum('table_count'))['sum']
    total_likes = user_posts.aggregate(total=Sum('count_likes'))['total'] or 0
    total_comments = user_posts.aggregate(total=Sum('count_comments'))['total'] or 0
    
    stats = {
        'total_posts': total_posts,
        'total_views': total_views,
        'total_likes': total_likes,
        'total_comments': total_comments,
    }
    
    recent_activities = []
    
    recent_comments = Comment.objects.filter(
        author=request.user
    ).select_related('post').order_by('-created_date')[:3]
    
    for comment in recent_comments:
        recent_activities.append({
            'type': 'comment',
            'post_title': comment.post.title,
            'date': comment.time_since(),
        })
    
    recent_likes = PostLikes.objects.filter(
        user=request.user
    ).select_related('post').order_by('-created_date')[:3]
    
    for like in recent_likes:
        recent_activities.append({
            'type': 'like',
            'post_title': like.post.title,
            'date': like.time_since() if hasattr(like, 'time_since') else timezone.now().strftime('%Y-%m-%d'),
        })
    
    for post in recent_posts[:3]:
        recent_activities.append({
            'type': 'post',
            'title': post.title,
            'date': post.created_date,
        })
    
    context = {
        'recent_posts': recent_posts,
        'stats': stats,
        'recent_activities': recent_activities[:5],
    }
    
    return render(request, 'board/dashboard.html', context)
