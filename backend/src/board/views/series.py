from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.db.models import Count, F, Exists, OuterRef, Q
from django.utils import timezone
from django.http import Http404

from board.models import Post, Series, PostLikes, Profile, Follow


def series_detail(request, username, series_url):
    """
    View for the series detail page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get sorting order from request (default to ascending/oldest first)
    sort_order = request.GET.get('sort', 'asc')
    if sort_order not in ['asc', 'desc']:
        sort_order = 'asc'
    
    # Get the series
    try:
        series = Series.objects.get(
            owner=author,
            url=series_url,
        )
    except Series.DoesNotExist:
        raise Http404("Series does not exist")
    
    # Get posts in the series with proper sorting
    order_by = 'created_date' if sort_order == 'asc' else '-created_date'
    
    all_posts = Post.objects.select_related(
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
    ).order_by(order_by)
    
    # Process series data
    series.post_count = all_posts.count()

    # Format series date
    series.updated_date = series.updated_date.strftime('%Y-%m-%d')
    
    # Get current page and implement pagination
    page = int(request.GET.get('page', 1))
    posts_per_page = 10  # Show 10 posts per page
    total_posts = all_posts.count()
    total_pages = (total_posts + posts_per_page - 1) // posts_per_page  # Ceiling division
    
    # Validate page number
    if page < 1 or (total_posts > 0 and page > total_pages):
        raise Http404("Page not found")
    
    # Calculate start and end indices for pagination
    start_idx = (page - 1) * posts_per_page
    end_idx = min(start_idx + posts_per_page, total_posts)
    
    # Get paginated posts
    paginated_posts = all_posts[start_idx:end_idx]
    
    # Create list of (post_number, post) tuples
    posts_with_numbers = []
    for i, post in enumerate(paginated_posts, start=start_idx + 1):
        # Format post date and calculate read time
        post.created_date = post.created_date.strftime('%Y-%m-%d')
        
        # Safely calculate read time without using len() on PostContent objects
        try:
            # Try to get content length if it's a string
            if hasattr(post, 'content') and isinstance(post.content, str):
                word_count = len(post.content)
            else:
                # Default word count if content is not a string or doesn't exist
                word_count = 500
        except:
            # Fallback if any error occurs
            word_count = 500
            
        post.read_time = max(1, round(word_count / 200))
        posts_with_numbers.append((i, post))
    
    # Determine if we need previous/next page buttons
    has_previous = page > 1
    has_next = page < total_pages
    
    context = {
        'author': author,
        'series': series,
        'posts': posts_with_numbers,
        'is_loading': False,
        'page': page,
        'total_pages': total_pages,
        'has_previous': has_previous,
        'has_next': has_next,
        'previous_page': page - 1 if has_previous else None,
        'next_page': page + 1 if has_next else None,
        'sort_order': sort_order,
        'request': request,
    }
    
    return render(request, 'board/series_detail.html', context)


@login_required
def series_create(request, username):
    """
    View for the series create page.
    """
    author = get_object_or_404(User, username=username)
    
    # Check if the current user is the author
    if request.user != author:
        return render(request, 'board/error/403.html', status=403)
    
    # Get posts that can be added to a series (posts without a series)
    available_posts = Post.objects.select_related('config').filter(
        author=author,
        series__isnull=True,
        created_date__lte=timezone.now(),
        config__hide=False,
    ).order_by('-created_date')
    
    context = {
        'author': author,
        'available_posts': available_posts,
        'is_loading': False,
    }
    
    return render(request, 'board/series/series_create.html', context)


@login_required  
def series_edit(request, username, series_url):
    """
    View for the series edit page.
    """
    author = get_object_or_404(User, username=username)
    
    # Check if the current user is the author
    if request.user != author:
        return render(request, 'board/error/403.html', status=403)
    
    # Get the series to edit
    series = get_object_or_404(Series, owner=author, url=series_url)
    
    # Get all posts that can be added to a series (posts without a series OR posts in this series)
    available_posts = Post.objects.select_related('config').filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False,
    ).filter(
        Q(series__isnull=True) | Q(series=series)
    ).order_by('-created_date')
    
    # Get posts currently in this series
    current_post_ids = list(Post.objects.filter(series=series).values_list('id', flat=True))
    
    context = {
        'author': author,
        'series': series,
        'available_posts': available_posts,
        'current_post_ids': current_post_ids,
        'is_loading': False,
    }
    
    return render(request, 'board/series/series_edit.html', context)
