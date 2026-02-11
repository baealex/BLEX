import json

from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.db.models import Case, When, Count, Exists, OuterRef, Q, F
from django.shortcuts import render, get_object_or_404, redirect
from django.utils import timezone
from django.http import JsonResponse

from board.modules.paginator import Paginator
from board.modules.time import time_since
from board.services.user_service import UserService
from board.models import Post, Series, PostLikes, Tag, Profile
from modules import markdown


def author_overview(request, username):
    """
    View for the author's overview page.
    Includes contribution graph, pinned posts, and simplified profile info.
    Readers and editors see different templates.
    """
    author = get_object_or_404(User.objects.select_related('profile'), username=username)

    recent_activities = UserService.get_user_dashboard_activities(author)[:10]  # Limit to 10 most recent

    about_html = getattr(author.profile, 'about_html', '') if hasattr(author, 'profile') else ''

    # Check if author is a reader (not an editor)
    is_reader = not hasattr(author, 'profile') or author.profile.role == Profile.Role.READER

    if is_reader:
        # Reader template - minimal view with just README and activity
        context = {
            'author': author,
            'recent_activities': recent_activities,
            'about_html': about_html,
            'author_activity_props': json.dumps({'username': author.username})
        }
        return render(request, 'board/author/author_reader_overview.html', context)
    else:
        # Editor template - full view with stats, pinned posts, notices
        pinned_posts = UserService.get_user_pinned_or_most_liked_posts(author)

        blog_notices = Post.objects.select_related(
            'config', 'author', 'author__profile'
        ).only(
            'title', 'url', 'published_date',
            'config__notice', 'config__hide',
            'author__username', 'author__profile__avatar'
        ).filter(
            author=author,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
            config__notice=True,
            config__hide=False,
        ).order_by('-published_date')[:5]

        stats = UserService.get_author_stats(author)

        context = {
            'author': author,
            'pinned_posts': pinned_posts,
            'recent_activities': recent_activities,
            'about_html': about_html,
            'post_count': stats['post_count'],
            'series_count': stats['series_count'],
            'blog_notices': blog_notices,
            'author_activity_props': json.dumps({'username': author.username})
        }
        return render(request, 'board/author/author_overview.html', context)


def author_about(request, username):
    """
    Redirect from legacy /about URL to overview page.
    """
    return redirect('user_profile', username=username)


def author_posts(request, username):
    """
    View for the author's posts page.
    Only accessible for editors. Readers are redirected to about page.
    """
    author = get_object_or_404(User.objects.select_related('profile'), username=username)

    if not hasattr(author, 'profile') or not author.profile.is_editor():
        return redirect('user_about', username=username)
    
    # Get search query and filters
    search_query = request.GET.get('q', '')
    sort_option = request.GET.get('sort', 'recent')
    tag_filter = request.GET.get('tag', '')

    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile', 'content'
    ).filter(
        author=author,
        published_date__isnull=False,
        published_date__lte=timezone.now(),
        config__hide=False,
        config__notice=False,
    )
    
    if search_query:
        posts = posts.filter(
            Q(title__icontains=search_query) | 
            Q(content__text_md__icontains=search_query) | 
            Q(content__text_html__icontains=search_query)
        )
    
    if tag_filter:
        posts = posts.filter(tags__value=tag_filter)
    
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
    
    if sort_option == 'popular':
        posts = posts.order_by('-count_likes', '-published_date')
    elif sort_option == 'comments':
        posts = posts.order_by('-count_comments', '-published_date')
    else:  # default to 'recent'
        posts = posts.order_by('-published_date')
    
    series = Series.objects.filter(
        owner__username=username,
        hide=False,
    ).annotate(
        count_posts=Count('posts', filter=Q(posts__config__hide=False)),
    ).order_by('-updated_date')
    
    author_tags = Tag.objects.filter(
        posts__author=author,
        posts__config__hide=False
    ).annotate(
        count=Count('posts', distinct=True)
    ).order_by('-count', 'value')

    tag_options = [{'value': '', 'label': '전체 태그'}] # Default option
    for tag in author_tags:
        tag_options.append({'value': tag.value, 'label': f'{tag.value} ({tag.count})'})

    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )

    # paginator에서 total count 가져오기 (별도 쿼리 불필요)
    post_count = paginated_posts.paginator.count
    series_count = series.count()
    
    sort_options = [
        {'value': 'recent', 'label': '최신순'},
        {'value': 'popular', 'label': '인기순'},
        {'value': 'comments', 'label': '댓글 많은 순'}
    ]

    for post in paginated_posts:
        post.time_display = time_since(post.published_date)

    context = {
        'author': author,
        'posts': paginated_posts,
        'post_count': post_count,
        'series_count': series_count,
        'page_number': page,
        'page_count': paginated_posts.paginator.num_pages,
        'author_tags': author_tags,
        'search_query': search_query,
        'sort_option': sort_option,
        'tag_filter': tag_filter,
        'tag_options': tag_options,
        'sort_options': sort_options,
        'author_activity_props': json.dumps({'username': author.username}),
    }
    
    return render(request, 'board/author/author_posts.html', context)


def author_series(request, username):
    """
    View for the author's series page.
    Only accessible for editors. Readers are redirected to about page.
    """
    author = get_object_or_404(User.objects.select_related('profile'), username=username)

    # If author is a reader (not an editor), redirect to about page
    # If profile doesn't exist, treat as reader
    if not hasattr(author, 'profile') or not author.profile.is_editor():
        return redirect('user_about', username=username)
    
    # Get search query and filters
    search_query = request.GET.get('q', '')
    sort_option = request.GET.get('sort', 'custom')
    
    series_list = Series.objects.filter(
        owner=author,
        hide=False
    )
    
    if search_query:
        series_list = series_list.filter(
            Q(name__icontains=search_query) | 
            Q(text_md__icontains=search_query)
        )
    
    series_list = series_list.annotate(
        post_count=Count(
            Case(
                When(
                    posts__published_date__isnull=False,
                    posts__published_date__lte=timezone.now(),
                    posts__config__hide=False,
                    then=1
                )
            )
        )
    ).filter(post_count__gte=1)
    
    if sort_option == 'newest':
        series_list = series_list.order_by('-created_date')
    elif sort_option == 'oldest':
        series_list = series_list.order_by('created_date')
    elif sort_option == 'posts':
        series_list = series_list.order_by('-post_count')
    elif sort_option == 'custom':
        series_list = series_list.order_by('order')
    
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
    
    for series_item in paginated_series:
        series_item.updated_date = series_item.updated_date.strftime('%Y-%m-%d')

    author_tags = Tag.objects.filter(
        posts__author=author,
        posts__config__hide=False
    ).annotate(
        count=Count('posts', distinct=True)
    ).order_by('-count', 'value')

    stats = UserService.get_author_stats(author)

    context = {
        'author': author,
        'series_list': paginated_series,
        'post_count': stats['post_count'],
        'series_count': stats['series_count'],
        'is_loading': False,
        'author_tags': author_tags,
        'search_query': search_query,
        'sort_option': sort_option,
        'page_number': page,
        'page_count': paginated_series.paginator.num_pages,
        'series_sort_options': series_sort_options,
    }
    
    return render(request, 'board/author/author_series.html', context)




@login_required
def author_about_edit(request, username):
    """
    View for the author's about edit page.
    """
    author = get_object_or_404(User.objects.select_related('profile'), username=username)

    if request.user != author:
        return render(request, 'board/error/403.html', status=403)

    profile, created = Profile.objects.get_or_create(user=author)

    if request.method == 'POST':
        new_about_md = request.POST.get('about_md', '')
        profile.about_md = new_about_md
        profile.about_html = markdown.parse_to_html(new_about_md)
        try:
            profile.save()
            return JsonResponse({'status': 'success', 'message': '소개가 성공적으로 업데이트되었습니다.'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

    # GET request handling
    about_md = getattr(profile, 'about_md', '') if profile else ''

    stats = UserService.get_author_stats(author)

    context = {
        'author': author,
        'about_md': about_md,
        'post_count': stats['post_count'],
        'series_count': stats['series_count'],
        'is_loading': False,
    }

    return render(request, 'board/author/author_about_edit.html', context)
