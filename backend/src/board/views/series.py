from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.db.models import Count, F, Exists, OuterRef, Q
from django.utils import timezone
from django.http import Http404

from board.models import Post, Series, PostLikes, Profile
from board.services import SeriesService


def series_detail(request, username, series_url):
    """
    View for the series detail page.
    """
    author = get_object_or_404(User, username=username)

    author = get_object_or_404(User, username=username)

    sort_order = request.GET.get('sort', 'asc')
    if sort_order not in ['asc', 'desc']:
        sort_order = 'asc'

    try:
        series = Series.objects.get(
            owner=author,
            url=series_url,
        )
    except Series.DoesNotExist:
        raise Http404("Series does not exist")

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

    series.post_count = all_posts.count()

    series.updated_date = series.updated_date.strftime('%Y-%m-%d')

    page = int(request.GET.get('page', 1))
    posts_per_page = 10  # Show 10 posts per page
    total_posts = all_posts.count()
    total_pages = (total_posts + posts_per_page - 1) // posts_per_page  # Ceiling division

    if page < 1 or (total_posts > 0 and page > total_pages):
        raise Http404("Page not found")

    start_idx = (page - 1) * posts_per_page
    end_idx = min(start_idx + posts_per_page, total_posts)

    paginated_posts = all_posts[start_idx:end_idx]

    posts_with_numbers = []
    for i, post in enumerate(paginated_posts):
        post.created_date = post.created_date.strftime('%Y-%m-%d')

        try:
            if hasattr(post, 'content') and isinstance(post.content, str):
                word_count = len(post.content)
            else:
                word_count = 500
        except:
            word_count = 500

        post.read_time = max(1, round(word_count / 200))

        if sort_order == 'desc':
            post_number = total_posts - start_idx - i
        else:
            post_number = start_idx + i + 1

        posts_with_numbers.append((post_number, post))

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

    return render(request, 'board/series/series_detail.html', context)


@login_required
def series_create(request, username):
    """
    View for the series create page.
    """
    author = get_object_or_404(User, username=username)

    author = get_object_or_404(User, username=username)

    if request.user != author and not request.user.is_staff:
        return render(request, 'board/error/403.html', status=403)

    available_posts = SeriesService.get_posts_available_for_series(author)

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

    author = get_object_or_404(User, username=username)

    series = get_object_or_404(Series, owner=author, url=series_url)

    if not SeriesService.can_user_edit_series(request.user, series):
        return render(request, 'board/error/403.html', status=403)

    available_posts = Post.objects.select_related('config').filter(
        author=author,
        created_date__lte=timezone.now(),
        config__hide=False,
    ).filter(
        Q(series__isnull=True) | Q(series=series)
    ).order_by('-created_date')

    current_post_ids = list(Post.objects.filter(series=series).values_list('id', flat=True))

    context = {
        'author': author,
        'series': series,
        'available_posts': available_posts,
        'current_post_ids': current_post_ids,
        'is_loading': False,
    }

    return render(request, 'board/series/series_edit.html', context)
