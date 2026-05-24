from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.db.models import F, Count, Exists, OuterRef

from board.models import Post, PostLikes
from board.modules.paginator import Paginator
from board.modules.time import time_since
from board.services.initial_setup_service import InitialSetupService
from board.services.public_post_service import PublicPostService
from board.services.user_service import UserService


def index(request):
    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('/setup')

    posts = PublicPostService.filter_public_posts(
        Post.objects.select_related(
            'config', 'series', 'author', 'author__profile'
        )
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

    posts = posts.order_by('-published_date')

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
    }

    return render(request, 'board/posts/post_list.html', context)


@login_required(login_url='/login')
def interested_posts(request):
    posts = UserService.get_user_interested_posts(request.user)

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
    }

    return render(request, 'board/posts/interested_posts.html', context)
