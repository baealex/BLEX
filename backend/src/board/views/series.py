from django.shortcuts import render, get_object_or_404
from django.contrib.auth.models import User
from django.db.models import Count, Exists, OuterRef
from django.utils import timezone
from django.http import Http404

from board.models import Post, Series, PostLikes
from board.services.agent_content_service import AgentContentService
from board.services.discovery_metadata_service import DiscoveryMetadataService


def series_detail(request, username, series_url):
    """
    View for the series detail page.
    """
    author = get_object_or_404(User, username=username)

    sort_order = request.GET.get('sort', 'desc')
    if sort_order not in ['asc', 'desc']:
        sort_order = 'desc'

    try:
        series = Series.objects.get(
            owner=author,
            url=series_url,
        )
    except Series.DoesNotExist:
        raise Http404("Series does not exist")

    order_by = 'published_date' if sort_order == 'asc' else '-published_date'

    all_posts = Post.objects.select_related(
        'config', 'author', 'author__profile'
    ).filter(
        series=series,
        published_date__isnull=False,
        published_date__lte=timezone.now(),
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

    page = int(request.GET.get('page', 1))
    posts_per_page = 10  # Show 10 posts per page
    total_posts = all_posts.count()
    total_pages = (total_posts + posts_per_page - 1) // posts_per_page  # Ceiling division

    series.post_count = total_posts

    if page < 1 or (total_posts > 0 and page > total_pages):
        raise Http404("Page not found")

    start_idx = (page - 1) * posts_per_page
    end_idx = min(start_idx + posts_per_page, total_posts)

    paginated_posts = all_posts[start_idx:end_idx]
    metadata = DiscoveryMetadataService.build_series_metadata(
        series=series,
        author=author,
        request=request,
        posts=list(paginated_posts),
        total_posts=total_posts,
        page=page,
        sort_order=sort_order,
    )

    posts_with_numbers = []
    for i, post in enumerate(paginated_posts):
        post.published_date_display = post.published_date.strftime('%Y-%m-%d')

        if sort_order == 'desc':
            post_number = total_posts - start_idx - i
        else:
            post_number = start_idx + i + 1

        posts_with_numbers.append((post_number, post))

    has_previous = page > 1
    has_next = page < total_pages

    aeo_enabled = AgentContentService.is_aeo_enabled()
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
        'aeo_enabled': aeo_enabled,
        'series_updated_date_display': series.updated_date.strftime('%Y-%m-%d'),
        **metadata,
    }
    if aeo_enabled:
        context['series_markdown_url'] = AgentContentService.build_series_markdown_url(series, request)

    response = render(request, 'board/series/series_detail.html', context)
    if aeo_enabled:
        response['Link'] = AgentContentService.build_agent_link_header_for_markdown_url(
            context['series_markdown_url'],
            request,
        )
        response['X-Llms-Txt'] = AgentContentService.build_llms_txt_url(request)
    return response
