from django.shortcuts import render
from django.utils import timezone
from django.db.models import F, Count, Exists, OuterRef

from board.models import Post, PostLikes
from board.modules.paginator import Paginator


def index(request):
    """
    Main page view that renders the homepage with newest posts.
    This replaces the frontend React component with a Django template.
    """
    # Get posts with the same annotations as the API endpoint
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        created_date__lte=timezone.now(),
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
    ).order_by('-created_date')

    # Paginate the results
    page = request.GET.get('page', 1)
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )
    
    # Format dates and prepare context
    for post in paginated_posts:
        post.created_date = post.time_since()
    
    context = {
        'posts': paginated_posts,
        'has_next_page': int(page) < paginated_posts.paginator.num_pages,
        'next_page': int(page) + 1,
    }
    
    return render(request, 'board/index.html', context)
