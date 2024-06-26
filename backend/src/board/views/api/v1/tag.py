from django.db.models import F, Count, Case, When, Subquery, OuterRef, Exists
from django.http import Http404
from django.utils import timezone

from board.models import Tag, Post, PostLikes
from board.modules.response import StatusDone
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime


def tag_list(request):
    if request.method == 'GET':
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

        tags = Paginator(
            objects=tags,
            offset=50,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'tags': list(map(lambda tag: {
                'name': tag.value,
                'count': tag.count,
                'image': tag.get_image(),
            }, tags)),
            'last_page': tags.paginator.num_pages
        })

    raise Http404


def tag_detail(request, name):
    if request.method == 'GET':
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

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )

        head_post = Post.objects.filter(
            url=name,
            config__hide=False
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
        ).first()

        return StatusDone({
            'tag': name,
            'head_post': {
                'author': head_post.author_username,
                'author_image': head_post.author_image,
                'url': head_post.url,
                'description': head_post.meta_description,
            } if head_post is not None else None,
            'last_page': posts.paginator.num_pages,
            'posts': list(map(lambda post: {
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
            }, posts))
        })

    raise Http404
