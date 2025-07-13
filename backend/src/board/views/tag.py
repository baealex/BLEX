from django.db.models import F, Count, Case, When, Subquery, OuterRef, Exists
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone

from board.models import Tag, Post, PostLikes


def tag_list_view(request):
    """
    View function for displaying a list of all tags.
    """
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
    ).order_by('-count', 'value')

    # Pagination
    page_number = int(request.GET.get('page', 1))
    page_size = 50
    start_idx = (page_number - 1) * page_size
    end_idx = start_idx + page_size
    
    total_tags = tags.count()
    page_count = (total_tags + page_size - 1) // page_size  # Ceiling division
    
    tags_page = tags[start_idx:end_idx]
    
    tag_list = []
    for tag in tags_page:
        tag_list.append({
            'name': tag.value,
            'count': tag.count,
            'image': tag.get_image(),
        })

    context = {
        'tags': tag_list,
        'page_number': page_number,
        'page_count': page_count,
    }
    
    return render(request, 'board/tag_list.html', context)


def tag_detail_view(request, name):
    """
    View function for displaying posts with a specific tag.
    """
    posts = Post.objects.select_related(
        'config', 'content'
    ).filter(
        created_date__lte=timezone.now(),
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
    page_number = int(request.GET.get('page', 1))
    page_size = 24
    start_idx = (page_number - 1) * page_size
    end_idx = start_idx + page_size
    
    total_posts = posts.count()
    page_count = (total_posts + page_size - 1) // page_size  # Ceiling division
    
    posts_page = posts[start_idx:end_idx]

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

    post_list = []
    for post in posts_page:
        post_list.append({
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'description': post.meta_description,
            'read_time': post.read_time,
            'created_date': post.time_since(),
            'author_image': post.author_image,
            'author': post.author_username,
            'count_likes': post.count_likes,
            'count_comments': post.count_comments,
            'has_liked': post.has_liked,
        })

    context = {
        'tag': name,
        'head_post': head_post_data,
        'posts': post_list,
        'page_number': page_number,
        'page_count': page_count,
    }
    
    return render(request, 'board/tag_detail.html', context)
