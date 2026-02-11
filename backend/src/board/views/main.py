from django.shortcuts import render
from django.utils import timezone
from django.db.models import F, Count, Exists, OuterRef

from board.models import Post, PostLikes
from board.modules.paginator import Paginator
from board.modules.time import time_since


def index(request):
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        published_date__isnull=False,
        published_date__lte=timezone.now(),
        config__notice=False,
        config__hide=False,
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
    )

    sort_type = request.GET.get('sort', 'latest')

    if sort_type == 'popular':
        posts = posts.order_by('-count_likes', '-created_date')
    elif sort_type == 'comments':
        posts = posts.order_by('-count_comments', '-created_date')
    else:
        posts = posts.order_by('-created_date')

    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )

    for post in paginated_posts:
        post.time_display = time_since(post.published_date)

    context = {
        'posts': paginated_posts,
        'page_number': page,
        'page_count': paginated_posts.paginator.num_pages,
        'sort_type': sort_type,
    }

    return render(request, 'board/posts/post_list.html', context)


