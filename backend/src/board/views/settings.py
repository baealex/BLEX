from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib import messages
from django.utils import timezone
from django.db.models import F, Count, Sum

from board.models import Series, Post, PostAnalytics, Comment, PostLikes

@login_required
def setting_dashboard(request):
    """
    Dashboard settings page view.
    Shows user's blog statistics and activities within the settings area.
    """
    # Get user's posts
    user_posts = Post.objects.filter(
        author=request.user,
        created_date__lte=timezone.now(),
    ).annotate(
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
    )
    
    # Calculate statistics
    total_posts = user_posts.count()
    total_views = PostAnalytics.objects.filter(
        post__author=request.user
    ).annotate(
        table_count=Count('devices'),
    ).aggregate(sum=Sum('table_count'))['sum'] or 0
    total_likes = user_posts.aggregate(total=Sum('count_likes'))['total'] or 0
    total_comments = user_posts.aggregate(total=Sum('count_comments'))['total'] or 0
    
    stats = {
        'total_posts': total_posts,
        'total_views': total_views,
        'total_likes': total_likes,
        'total_comments': total_comments,
    }
    
    recent_activities = []
    
    recent_posts = user_posts.order_by('-created_date')[:3]
    for post in recent_posts:
        recent_activities.append({
            'type': 'post',
            'title': post.title,
            'date': post.time_since(),
        })
    
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
    
    # Sort activities by date and limit
    recent_activities = sorted(recent_activities, key=lambda x: x.get('date', ''), reverse=True)[:5]
    
    context = {
        'active': 'dashboard',
        'stats': stats,
        'recent_activities': recent_activities,
    }
    return render(request, 'board/setting/setting_dashboard.html', context)


@login_required
def setting_profile(request):
    """
    Profile settings page view.
    Renders the profile settings template with user profile data.
    """
    context = {
        'active': 'profile'
    }
    return render(request, 'board/setting/setting_profile.html', context)


@login_required
def setting_account(request):
    """
    Account settings page view.
    Renders the account settings template with user account data.
    """
    context = {
        'active': 'account'
    }
    return render(request, 'board/setting/setting_account.html', context)


@login_required
def setting_notify(request):
    """
    Notification settings page view.
    Renders the notification settings template with user notification preferences.
    """
    context = {
        'active': 'notify'
    }
    return render(request, 'board/setting/setting_notify.html', context)


@login_required
def setting_series(request):
    """
    Series management page view.
    Renders the series management template with user's series data.
    """
    context = {
        'active': 'series'
    }
    return render(request, 'board/setting/setting_series.html', context)


@login_required
def setting_posts(request):
    """
    Posts management page view.
    Renders the posts management template with user's posts data.
    """
    context = {
        'active': 'posts'
    }
    return render(request, 'board/setting/setting_posts.html', context)


@login_required
def setting_analytics(request):
    """
    Analytics settings page view.
    Renders the analytics template with user's visitor statistics.
    """
    context = {
        'active': 'analytics'
    }
    return render(request, 'board/setting/setting_analytics.html', context)


@login_required
def setting_integration(request):
    """
    Integration settings page view.
    Renders the integration settings template with user's integration configurations.
    """
    context = {
        'active': 'integration'
    }
    return render(request, 'board/setting/setting_integration.html', context)


@login_required
def setting_invitation(request):
    """
    Invitation management page view.
    Renders the invitation management template with user's invitation codes.
    """
    context = {
        'active': 'invitation'
    }
    return render(request, 'board/setting/setting_invitation.html', context)


@login_required
def setting_forms(request):
    """
    Forms management page view.
    Renders the forms management template with user's saved forms.
    """
    context = {
        'active': 'forms'
    }
    return render(request, 'board/setting/setting_forms.html', context)
