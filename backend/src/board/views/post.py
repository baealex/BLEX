from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.utils import timezone
from django.http import Http404

from board.models import Post, Series, PostLikes, Profile, Follow, Comment


def post_detail(request, username, post_url):
    """
    View for the post detail page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get the post
    try:
        post = Post.objects.select_related(
            'config', 'series', 'author', 'author__profile'
        ).filter(
            author=author,
            url=post_url,
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
        ).get()
    except Post.DoesNotExist:
        raise Http404("Post does not exist")
    
    # Check if the post is hidden and if the user has permission to view it
    if post.config.hide and (not request.user.is_authenticated or request.user != author):
        raise Http404("Post does not exist")
    
    # Calculate read time (approximately 200 words per minute)
    word_count = len(post.content.text_html.strip().split())
    post.read_time = max(1, round(word_count / 200))
    
    # Format date
    post.created_date = post.created_date.strftime('%Y-%m-%d')
    
    # Initialize series attributes to avoid AttributeError
    post.series_total = 0
    post.visible_series_posts = []
    post.prev_post = None
    post.next_post = None
    
    # Get series posts if the post is part of a series
    if post.series:
        series_posts = list(Post.objects.filter(
            series=post.series,
            config__hide=False,
        ).order_by('created_date'))
        
        post.series_total = len(series_posts)
        
        # Add series_index to each post in the series
        for i, series_post in enumerate(series_posts):
            series_post.series_index = i + 1
            if series_post.id == post.id:
                post.series_index = i + 1
        
        # Prepare visible series posts for the template (max 5 posts)
        visible_posts = []
        current_idx = post.series_index - 1  # Convert to 0-based index
        
        # Determine which posts to show based on current position
        if post.series_total <= 5:
            # If 5 or fewer posts, show all
            visible_posts = series_posts
        elif post.series_index <= 3:
            # If near the beginning, show first 5
            visible_posts = series_posts[:5]
        elif post.series_index >= post.series_total - 2:
            # If near the end, show last 5
            visible_posts = series_posts[-5:]
        else:
            # Show 2 before and 2 after current post
            start = max(0, current_idx - 2)
            end = min(post.series_total, current_idx + 3)
            visible_posts = series_posts[start:end]
        
        # Get previous and next posts if they exist
        post.prev_post = series_posts[current_idx - 1] if current_idx > 0 else None
        post.next_post = series_posts[current_idx + 1] if current_idx < post.series_total - 1 else None
        post.visible_series_posts = visible_posts
    
    # Get related posts (posts with similar tags)
    related_posts = []
    # if post.tags:
    #     related_posts = Post.objects.select_related(
    #         'author', 'author__profile'
    #     ).filter(
    #         tags__overlap=post.tags,
    #         config__hide=False,
    #     ).exclude(
    #         id=post.id
    #     ).annotate(
    #         author_username=F('author__username'),
    #         author_image=F('author__profile__avatar'),
    #         count_likes=Count('likes', distinct=True),
    #         count_comments=Count('comments', distinct=True),
    #     ).order_by('-created_date')[:3]
    #     
    #     # Format dates and calculate read time for related posts
    #     for related_post in related_posts:
    #         related_post.created_date = related_post.created_date.strftime('%Y-%m-%d')
    #         word_count = len(related_post.content.split())
    #         related_post.read_time = max(1, round(word_count / 200))
    
    context = {
        'post': post,
        'related_posts': related_posts,
    }
    
    return render(request, 'board/post_detail.html', context)


def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    # Check if user is authenticated
    if not request.user.is_authenticated:
        return redirect('login')
    
    is_edit = username is not None and post_url is not None
    post = None
    series_list = []
    
    # If editing an existing post
    if is_edit:
        author = get_object_or_404(User, username=username)
        
        # Check if the current user is the author
        if request.user != author:
            raise Http404("You don't have permission to edit this post")
        
        # Get the post
        try:
            post = Post.objects.select_related('config', 'series').get(
                author=author,
                url=post_url,
            )
        except Post.DoesNotExist:
            raise Http404("Post does not exist")
    
    # Get all series by the current user
    series_list = Series.objects.filter(owner=request.user).order_by('-updated_date')
    
    # Handle form submission
    if request.method == 'POST':
        # Process form data
        # This would be implemented based on the form structure
        pass
    
    context = {
        'is_edit': is_edit,
        'post': post,
        'series_list': series_list,
    }
    
    return render(request, 'board/post_editor.html', context)
