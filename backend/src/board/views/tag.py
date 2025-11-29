from django.http import Http404
from django.shortcuts import render
from board.modules.paginator import Paginator

from board.services import TagService


def tag_list_view(request):
    """
    View function for displaying a list of all tags.
    """
    search_query = request.GET.get('q', '').strip()

    sort = request.GET.get('sort', 'popular')

    tags = TagService.get_tag_list_with_count()

    if search_query:
        tags = tags.filter(value__icontains=search_query)

    if sort == 'popular':
        tags = tags.order_by('-count', 'value')
    elif sort == 'name':
        tags = tags.order_by('value')
    elif sort == 'recent':
        tags = tags.order_by('-id')
    else:
        tags = tags.order_by('-count', 'value')

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

    return render(request, 'board/tags/tag_list.html', context)


def tag_detail_view(request, name):
    """
    View function for displaying posts with a specific tag.
    """
    user_id = request.user.id if request.user.is_authenticated else None
    posts = TagService.get_posts_by_tag(name, user_id)

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

    head_post = TagService.get_head_post_by_tag(name)

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

    return render(request, 'board/tags/tag_detail.html', context)
