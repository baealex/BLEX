from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef, Q
from django.utils import timezone

from board.models import Post, Series, PostLikes, Profile, Follow


def author_posts(request, username):
    """
    View for the author's posts page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get author's posts
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False,
    ).annotate(
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
        has_liked=Exists(
            PostLikes.objects.filter(
                post__id=OuterRef('id'),
                user__id=request.user.id if request.user.id else -1
            )
        ),
    ).order_by('-created_date')
    
    # Get author's series
    series = Series.objects.filter(
        owner__username=username,
        hide=False,
    ).annotate(
        count_posts=Count('posts', filter=Q(posts__config__hide=False)),
        has_followed=Exists(
            Follow.objects.filter(
                follower_id=request.user.id if request.user.is_authenticated else None,
                following=OuterRef('owner')
            )
        ),
    ).order_by('-updated_date')
    
    # Count posts, series, and followers
    post_count = posts.count()
    series_count = series.count()
    follower_count = Follow.objects.filter(following=author.profile).count()
    
    # Check if the current user is following the author
    is_following = False
    if request.user.is_authenticated and request.user != author:
        is_following = Follow.objects.filter(
            follower_id=request.user.id,
            following=author.profile
        ).exists()
    
    context = {
        'author': author,
        'posts': posts,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_following': is_following,
    }
    
    return render(request, 'board/author/author.html', context)


def author_series(request, username):
    """
    View for the author's series page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get author's series
    series_list = Series.objects.filter(
        owner=author
    ).annotate(
        post_count=Count('posts'),
    ).order_by('-updated_date')
    
    # Process series data
    for series in series_list:
        # Count completed posts (could be based on some criteria)
        series.completed_count = series.post_count
        # Calculate completion percentage
        series.completion_percentage = 100 if series.post_count == 0 else int((series.completed_count / series.post_count) * 100)
        # Format date
        series.updated_date = series.updated_date.strftime('%Y-%m-%d')
    
    # Count posts, series, and followers
    post_count = Post.objects.filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False
    ).count()
    series_count = series_list.count()
    follower_count = Follow.objects.filter(following=author.profile).count()
    
    # Check if the current user is following the author
    is_following = False
    if request.user.is_authenticated and request.user != author:
        is_following = Follow.objects.filter(
            follower_id=request.user.id,
            following=author.profile
        ).exists()
    
    context = {
        'author': author,
        'series_list': series_list,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_following': is_following,
        'is_loading': False,
    }
    
    return render(request, 'board/author/author_series.html', context)


def author_about(request, username):
    """
    View for the author's about page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get author's profile
    profile = getattr(author, 'profile', None)
    about_content = getattr(profile, 'about', None)
    
    # Count posts, series, and followers
    post_count = Post.objects.filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False
    ).count()
    series_count = Series.objects.filter(owner=author).count()
    follower_count = Follow.objects.filter(following=author.profile).count()
    
    # Check if the current user is following the author
    is_following = False
    if request.user.is_authenticated and request.user != author:
        is_following = Follow.objects.filter(
            follower_id=request.user.id,
            following=author.profile
        ).exists()
    
    context = {
        'author': author,
        'about_content': about_content,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_following': is_following,
        'is_loading': False,
    }
    
    return render(request, 'board/author/author_about.html', context)
