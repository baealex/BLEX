
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import F
from django.http import Http404
from django.utils import timezone

from board.models import Post
from modules.telegram import TelegramBot
from modules.response import StatusDone
from board.views import function as fn

def tags(request, tag=None):
    if not tag:
        if request.method == 'GET':
            cache_key = 'main_page_topics'
            tags = cache.get(cache_key)
            if not tags:
                tags = sorted(fn.get_clean_all_tags(desc=True), key=lambda instance:instance['count'], reverse=True)
                cache_time = 3600
                cache.set(cache_key, tags, cache_time)
            page = request.GET.get('page', 1)
            paginator = Paginator(tags, (3 * 2) * 15)
            fn.page_check(page, paginator)
            tags = paginator.get_page(page)
            return StatusDone({
                'tags': list(map(lambda tag: {
                    'name': tag['name'],
                    'count': tag['count'],
                    'description': tag['desc']
                }, tags)),
                'last_page': tags.paginator.num_pages
            })
    
    if tag:
        if request.method == 'GET':
            posts = Post.objects.filter(
                created_date__lte=timezone.now(),
                hide=False, tag__iregex=r'\b%s\b' % tag
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            ).order_by('-created_date')
            
            if len(posts) == 0:
                raise Http404()
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 21)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            desc_object = dict()
            try:
                article = Post.objects.get(url=tag, hide=False).annotate(
                    author_username=F('author__username')
                )
                desc_object = {
                    'url': article.url,
                    'author': author_username,
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
                    'read_time': post.read_time,
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author_image,
                    'author': post.author_username,
                }, posts))
            })
        
    raise Http404