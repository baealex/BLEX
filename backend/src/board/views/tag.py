from django.db.models import F, Count, Case, When, Subquery, OuterRef, Exists
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone
from board.modules.paginator import Paginator

from board.models import Tag, Post, PostLikes


def tag_list_view(request):
    """
    View function for displaying a list of all tags.
    """
    # Get search query
    search_query = request.GET.get('q', '').strip()
    
    # Get sort parameter
    sort = request.GET.get('sort', 'popular')
    
    # Build base queryset
    tags = Tag.objects.filter(
        posts__config__hide=False
    ).annotate(
        count=Count(
            Case(
                When(
                    posts__config__hide=False,
                    then='posts'
                ),
            )
        ),
    )
    
    # Apply search filter
    if search_query:
        tags = tags.filter(value__icontains=search_query)
    
    # Apply sorting
    if sort == 'popular':
        tags = tags.order_by('-count', 'value')
    elif sort == 'name':
        tags = tags.order_by('value')
    elif sort == 'recent':
        tags = tags.order_by('-id')
    else:
        tags = tags.order_by('-count', 'value')

    # Pagination
    page = int(request.GET.get('page', 1))
    paginated_tags = Paginator(
        objects=tags,
        offset=50,
        page=page
    )
    
    tags_page = paginated_tags
    
    tag_list = []
    for tag in tags_page:
        tag_list.append({
            'name': tag.value,
            'count': tag.count,
            'image': tag.get_image(),
        })

    # Sort options for dropdown
    sort_options = [
        {'value': 'popular', 'label': '인기순'},
        {'value': 'name', 'label': '이름순'},
        {'value': 'recent', 'label': '최신순'},
    ]

    context = {
        'tags': tag_list,
        'page': page,
        'last_page': paginated_tags.paginator.num_pages,
        'sort_options': sort_options,
    }
    
    return render(request, 'board/tag_list.html', context)


def tag_detail_view(request, name):
    """
    View function for displaying posts with a specific tag.
    """
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        created_date__lte=timezone.now(),
        config__notice=False,
        config__hide=False,
        tags__value=name
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

    if len(posts) == 0:
        raise Http404()

    # Pagination
    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )
    
    posts_page = paginated_posts

    # Get head post if exists
    head_post = Post.objects.filter(
        url=name,
        config__hide=False
    ).annotate(
        author_username=F('author__username'),
        author_image=F('author__profile__avatar'),
    ).first()

    head_post_data = None
    if head_post:
        head_post_data = {
            'author': head_post.author_username,
            'author_image': head_post.author_image,
            'url': head_post.url,
            'title': head_post.title,
            'description': head_post.meta_description,
            'image': str(head_post.image) if head_post.image else None,
        }

    context = {
        'tag': name,
        'head_post': head_post_data,
        'posts': paginated_posts,
        'page': page,
        'last_page': paginated_posts.paginator.num_pages,
    }
    
    return render(request, 'board/tag_detail.html', context)
