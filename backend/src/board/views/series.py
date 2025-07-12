from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.utils import timezone
from django.http import Http404

from board.models import Post, Series, PostLikes, Profile, Follow


def series_detail(request, username, series_url):
    """
    View for the series detail page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get the series
    try:
        series = Series.objects.get(
            owner=author,
            url=series_url,
        )
    except Series.DoesNotExist:
        raise Http404("Series does not exist")
    
    # Get posts in the series
    posts = Post.objects.select_related(
        'config', 'author', 'author__profile'
    ).filter(
        series=series,
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
    ).order_by('created_date')
    
    # Process series data
    series.post_count = posts.count()
    # In a real implementation, you might have a way to track completed posts
    # For now, we'll assume all posts are completed
    series.completed_count = series.post_count
    series.completion_percentage = 100 if series.post_count == 0 else int((series.completed_count / series.post_count) * 100)
    
    # Format dates and calculate read time for posts
    for post in posts:
        post.created_date = post.created_date.strftime('%Y-%m-%d')
        word_count = len(post.content.split())
        post.read_time = max(1, round(word_count / 200))
    
    # Format series date
    series.updated_date = series.updated_date.strftime('%Y-%m-%d')
    
    context = {
        'author': author,
        'series': series,
        'posts': posts,
        'is_loading': False,
    }
    
    return render(request, 'board/series_detail.html', context)
