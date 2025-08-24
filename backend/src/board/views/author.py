from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Exists, OuterRef, Q, F, Case, When, Value, IntegerField
from django.utils import timezone
from board.modules.paginator import Paginator

from board.models import Post, Series, PostLikes, Follow, Tag


def author_posts(request, username):
    """
    View for the author's posts page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get search query and filters
    search_query = request.GET.get('q', '')
    sort_option = request.GET.get('sort', 'recent')
    tag_filter = request.GET.get('tag', '')
    
    # Base query for author's posts
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile', 'content'
    ).filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False,
    )
    
    # Apply search query if provided
    if search_query:
        posts = posts.filter(
            Q(title__icontains=search_query) | 
            Q(content__text_md__icontains=search_query) | 
            Q(content__text_html__icontains=search_query)
        )
    
    # Apply tag filter if provided
    if tag_filter:
        posts = posts.filter(tags__value=tag_filter)
    
    # Annotate with additional fields
    posts = posts.annotate(
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
    )
    
    # Apply sorting
    if sort_option == 'popular':
        posts = posts.order_by('-count_likes', '-created_date')
    elif sort_option == 'comments':
        posts = posts.order_by('-count_comments', '-created_date')
    else:  # default to 'recent'
        posts = posts.order_by('-created_date')
    
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
    
    # Get author's tags with post counts
    author_tags = Tag.objects.filter(
        posts__author=author,
        posts__config__hide=False
    ).annotate(
        count=Count('posts', distinct=True)
    ).order_by('-count', 'value')

    # Transform author_tags for dropdown_filter
    tag_options = [{'value': '', 'label': '전체 태그'}] # Default option
    for tag in author_tags:
        tag_options.append({'value': tag.value, 'label': f'{tag.value} ({tag.count})'})
    
    # Count posts, series, and followers
    post_count = Post.objects.filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False
    ).count()
    series_count = series.count()
    follower_count = Follow.objects.filter(following=author.profile).count()
    
    # Check if the current user is following the author
    is_following = False
    if request.user.is_authenticated and request.user != author:
        is_following = Follow.objects.filter(
            follower_id=request.user.id,
            following=author.profile
        ).exists()
    
    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )
    
    sort_options = [
        {'value': 'recent', 'label': '최신순'},
        {'value': 'popular', 'label': '인기순'},
        {'value': 'comments', 'label': '댓글 많은 순'}
    ]

    for post in paginated_posts:
        post.created_date = post.time_since()

    context = {
        'author': author,
        'posts': paginated_posts,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_following': is_following,
        'page_number': page,
        'page_count': paginated_posts.paginator.num_pages,
        'author_tags': author_tags,
        'search_query': search_query,
        'sort_option': sort_option,
        'tag_filter': tag_filter,
        'tag_options': tag_options,
        'sort_options': sort_options,
    }
    
    return render(request, 'board/author/author.html', context)


def author_series(request, username):
    """
    View for the author's series page.
    """
    author = get_object_or_404(User, username=username)
    
    # Get search query and filters
    search_query = request.GET.get('q', '')
    sort_option = request.GET.get('sort', 'newest')
    
    # Base query for author's series
    series_list = Series.objects.filter(owner=author)
    
    # Apply search query if provided
    if search_query:
        series_list = series_list.filter(
            Q(name__icontains=search_query) | 
            Q(text_md__icontains=search_query)
        )
    
    # Annotate with post count
    series_list = series_list.annotate(post_count=Count('posts'))
    
    if sort_option == 'newest':
        series_list = series_list.order_by('-created_date')
    elif sort_option == 'oldest':
        series_list = series_list.order_by('created_date')
    elif sort_option == 'posts':
        series_list = series_list.order_by('-post_count')
    elif sort_option == 'custom':
        series_list = series_list.order_by('order')
    
    # Apply pagination
    page = int(request.GET.get('page', 1))
    paginated_series = Paginator(
        objects=series_list,
        offset=12,  # Show 12 series per page
        page=page
    )
    
    series_sort_options = [
        {'value': 'custom', 'label': '작가 지정 순'},
        {'value': 'newest', 'label': '최신순'},
        {'value': 'oldest', 'label': '오래된순'},
        {'value': 'posts', 'label': '포스트 많은 순'},
    ]
    
    # Process series data
    for series in paginated_series:
        series.updated_date = series.updated_date.strftime('%Y-%m-%d')
    
    # Get author's tags with post counts
    author_tags = Tag.objects.filter(
        posts__author=author,
        posts__config__hide=False
    ).annotate(
        count=Count('posts', distinct=True)
    ).order_by('-count', 'value')
    
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
        'series_list': paginated_series,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_following': is_following,
        'is_loading': False,
        'author_tags': author_tags,
        'search_query': search_query,
        'sort_option': sort_option,
        'page_number': page,
        'page_count': paginated_series.paginator.num_pages,
        'series_sort_options': series_sort_options,
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


@login_required
def author_about_edit(request, username):
    """
    View for the author's about edit page.
    """
    author = get_object_or_404(User, username=username)
    
    # Check if the current user is the author
    if request.user != author:
        return render(request, 'board/error/403.html', status=403)
    
    # Get author's profile
    profile = getattr(author, 'profile', None)
    about_md = getattr(profile, 'about_md', '') if profile else ''
    
    # Count posts, series, and followers
    post_count = Post.objects.filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False
    ).count()
    series_count = Series.objects.filter(owner=author).count()
    follower_count = Follow.objects.filter(following=author.profile).count()
    
    context = {
        'author': author,
        'about_md': about_md,
        'post_count': post_count,
        'series_count': series_count,
        'follower_count': follower_count,
        'is_loading': False,
    }
    
    return render(request, 'board/author/author_about_edit.html', context)
