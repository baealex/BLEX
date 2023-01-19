from django.db.models import F, Count, Case, When
from django.http import Http404
from django.utils import timezone

from board.models import Tag, Post
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
            )
        ).order_by('-count')

        tags = Paginator(
            objects=tags,
            offset=48,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'tags': list(map(lambda tag: {
                'name': tag.value,
                'count': tag.count,
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
            author_image=F('author__profile__avatar')
        ).order_by('-created_date')

        if len(posts) == 0:
            raise Http404()

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )
        desc_object = dict()
        try:
            article = Post.objects.select_related(
                'content'
            ).filter(
                url=name,
                config__hide=False,
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar'),
            ).first()

            desc_object = {
                'url': article.url,
                'author': article.author_username,
                'author_image': article.author_image,
                'description': article.description(50)
            }
        except:
            pass

        return StatusDone({
            'tag': name,
            'desc': desc_object,
            'last_page': posts.paginator.num_pages,
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.description(),
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
            }, posts))
        })

    raise Http404
