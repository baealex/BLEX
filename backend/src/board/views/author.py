import json

from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q
from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.urls import reverse

from board.modules.paginator import Paginator
from board.modules.time import time_since
from board.services.user_service import UserService
from board.services.discovery_metadata_service import DiscoveryMetadataService
from board.services.public_post_service import PublicPostService
from board.services.public_series_service import PublicSeriesService
from board.models import Comment, Post, Series, PostLikes, Tag, Profile, SiteNotice, SiteContentScope
from modules import markdown


def author_overview(request, username):
    """
    View for the author's overview page.
    Includes contribution graph, pinned posts, and simplified profile info.
    Readers and editors see different templates.
    """
    author = get_object_or_404(User.objects.select_related('profile'), username=username)

    recent_activities = UserService.get_public_author_activities(author)[:10]

    about_html = getattr(author.profile, 'about_html', '') if hasattr(author, 'profile') else ''

    # Check if author is a reader (not an editor)
    is_reader = not hasattr(author, 'profile') or author.profile.role == Profile.Role.READER
    author_profile_path = reverse('user_profile', kwargs={'username': author.username})
    if DiscoveryMetadataService.has_unexpected_query_parameters(request, set()):
        page_metadata = DiscoveryMetadataService.build_noindex_page_metadata(
            request,
            author_profile_path,
        )
    else:
        page_metadata = DiscoveryMetadataService.build_paginated_page_metadata(
            request,
            author_profile_path,
            1,
            1,
        )

    if is_reader:
        # Reader template - minimal view with just README and activity
        context = {
            'author': author,
            'recent_activities': recent_activities,
            'about_html': about_html,
            **page_metadata,
            'author_activity_props': json.dumps({'username': author.username})
        }
        return render(request, 'board/author/author_reader_overview.html', context)
    else:
        # Editor template - full view with stats, pinned posts
        featured_posts_section = UserService.get_user_profile_featured_posts(author)

        stats = UserService.get_author_stats(author)

        user_notices = SiteNotice.objects.filter(
            scope=SiteContentScope.USER,
            user=author,
            is_active=True,
        ).order_by('order', '-created_date')

        context = {
            'author': author,
            'featured_posts_section': featured_posts_section,
            'pinned_posts': featured_posts_section['posts'],
            'recent_activities': recent_activities,
            'about_html': about_html,
            'post_count': stats['post_count'],
            'series_count': stats['series_count'],
            'user_notices': user_notices,
            **DiscoveryMetadataService.build_user_rss_feed_metadata(author, request),
            **page_metadata,
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
    tag_filter = request.GET.get('tag', '')

    posts = PublicPostService.filter_public_posts(
        Post.objects.select_related(
            'config', 'series', 'author', 'author__profile'
        )
    ).filter(
        author=author,
    )

    if search_query:
        posts = posts.filter(
            Q(title__icontains=search_query) |
            Q(content__content_html__icontains=search_query)
        )

    if tag_filter:
        posts = posts.filter(tags__value=tag_filter).distinct()

    posts = posts.order_by('-published_date')

    public_author_tag_filter = PublicPostService.build_public_filter('posts') & Q(
        posts__author=author,
    )
    author_tags = Tag.objects.filter(
        public_author_tag_filter
    ).distinct().order_by('value')

    tag_options = [{'value': '', 'label': '전체 태그'}]
    for tag in author_tags:
        tag_options.append({'value': tag.value, 'label': tag.value})

    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )

    post_count = paginated_posts.paginator.count
    series_count = PublicSeriesService.filter_public_series(
        Series.objects.filter(owner=author),
        'count_posts',
    ).count()

    page_posts = list(paginated_posts)
    post_ids = [post.id for post in page_posts]
    like_counts = {
        item['post_id']: item['count']
        for item in PostLikes.objects.filter(post_id__in=post_ids)
        .values('post_id')
        .annotate(count=Count('id'))
    }
    comment_counts = {
        item['post_id']: item['count']
        for item in Comment.objects.filter(post_id__in=post_ids)
        .values('post_id')
        .annotate(count=Count('id'))
    }
    liked_post_ids = set()
    if request.user.is_authenticated:
        liked_post_ids = set(
            PostLikes.objects.filter(post_id__in=post_ids, user=request.user)
            .values_list('post_id', flat=True)
        )

    for post in page_posts:
        post.count_likes = like_counts.get(post.id, 0)
        post.count_comments = comment_counts.get(post.id, 0)
        post.has_liked = post.id in liked_post_ids
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
        'tag_filter': tag_filter,
        'tag_options': tag_options,
        **DiscoveryMetadataService.build_user_rss_feed_metadata(author, request),
        'author_activity_props': json.dumps({'username': author.username}),
    }
    author_posts_path = reverse('user_posts', kwargs={'username': author.username})
    if (
        DiscoveryMetadataService.has_unexpected_query_parameters(request, {'page', 'q', 'tag'})
        or search_query
        or tag_filter
    ):
        context.update(
            DiscoveryMetadataService.build_noindex_page_metadata(
                request,
                author_posts_path,
            )
        )
    else:
        context.update(
            DiscoveryMetadataService.build_paginated_page_metadata(
                request,
                author_posts_path,
                page,
                paginated_posts.paginator.num_pages,
            )
        )
    
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
    
    series_list = PublicSeriesService.filter_public_series(series_list, 'post_count')
    
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

    public_author_tag_filter = PublicPostService.build_public_filter('posts') & Q(
        posts__author=author,
    )
    author_tags = Tag.objects.filter(
        public_author_tag_filter
    ).annotate(
        count=Count('posts', filter=public_author_tag_filter, distinct=True)
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
        **DiscoveryMetadataService.build_user_rss_feed_metadata(author, request),
    }
    author_series_path = reverse('user_series', kwargs={'username': author.username})
    if (
        DiscoveryMetadataService.has_unexpected_query_parameters(request, {'page', 'q', 'sort'})
        or search_query
        or sort_option != 'custom'
    ):
        context.update(
            DiscoveryMetadataService.build_noindex_page_metadata(
                request,
                author_series_path,
            )
        )
    else:
        context.update(
            DiscoveryMetadataService.build_paginated_page_metadata(
                request,
                author_series_path,
                page,
                paginated_series.paginator.num_pages,
            )
        )
    
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
        profile.about_html = markdown.parse_post_to_html(new_about_md)
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
