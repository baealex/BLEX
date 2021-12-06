
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import F, Count, Case, When
from django.http import Http404
from django.utils import timezone

from board.models import Tag, Post, convert_to_localtime
from modules.telegram import TelegramBot
from modules.response import StatusDone
from board.views import function as fn

def tags(request, tag=None):
    if not tag:
        if request.method == 'GET':
            tags = Tag.objects.filter(
                posts__hide=False
            ).annotate(
                count=Count(
                    Case(
                        When(
                            posts__hide=False,
                            then='posts'
                        ),
                    )
                )
            ).order_by('-count')
            page = request.GET.get('page', 1)
            paginator = Paginator(tags, 48)
            fn.page_check(page, paginator)
            tags = paginator.get_page(page)
            return StatusDone({
                'tags': list(map(lambda tag: {
                    'name': tag.value,
                    'count': tag.count,
                }, tags)),
                'last_page': tags.paginator.num_pages
            })
    
    if tag:
        if request.method == 'GET':
            posts = Post.objects.filter(
                created_date__lte=timezone.now(),
                hide=False,
                tags__value=tag
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            ).order_by('-created_date')
            
            if len(posts) == 0:
                raise Http404()
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 24)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            desc_object = dict()
            try:
                article = Post.objects.filter(url=tag, hide=False).annotate(
                    author_username=F('author__username')
                ).first()
                desc_object = {
                    'url': article.url,
                    'author': article.author_username,
                    'description': article.description(80)
                }
            except:
                pass
            
            return StatusDone({
                'tag': tag,
                'desc_posts': desc_object,
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