import traceback
import datetime

from django.conf import settings
from django.core.cache import cache
from django.db.models import (
    F, Q, Case, Exists, When,
    Value, OuterRef, Count)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.utils.timesince import timesince

from board.models import (
    Comment, Referer, PostAnalytics, Series,
    TempPosts, Post, PostContent, PostConfig,
    PostThanks, PostNoThanks, calc_read_time, convert_to_localtime)
from board.modules.analytics import create_history, get_network_addr, view_count
from board.modules.notify import create_notify
from board.modules.paginator import Paginator
from board.modules.requests import BooleanType
from board.modules.response import StatusDone, StatusError
from board.views import function as fn
from modules.markdown import parse_to_html, ParseData
from modules.randomness import randstr

def temp_posts(request, token=None):
    if not request.user.is_active:
        return HttpResponse('error:NL')
    
    if not token:
        if request.GET.get('get') == 'list':
            temps = TempPosts.objects.filter(author=request.user)
            return StatusDone({
                'temps': list(map(lambda temp: {
                    'token': temp.token,
                    'title': temp.title,
                    'created_date': timesince(temp.created_date)
                }, temps)),
            })

        if request.method == 'POST':
            temps = TempPosts.objects.filter(author=request.user).count()
            if temps >= 100:
                return StatusError('OF')
            
            body = QueryDict(request.body)

            token = randstr(25)
            has_token = TempPosts.objects.filter(token=token, author=request.user)
            while len(has_token) > 0:
                token = randstr(25)
                has_token = TempPosts.objects.filter(token=token, author=request.user)
            
            temp_posts = TempPosts(token=token, author=request.user)
            temp_posts.title = body.get('title')
            temp_posts.text_md = body.get('text_md')
            temp_posts.save()

            return StatusDone({
                'token': token
            })
    
    if token:
        if request.method == 'GET':
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            return StatusDone({
                'token': temp_posts.token,
                'title': temp_posts.title,
                'text_md': temp_posts.text_md,
                'tags': [],
                'created_date': timesince(temp_posts.created_date),
            })
        
        if request.method == 'PUT':
            body = QueryDict(request.body)
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            temp_posts.title = body.get('title')
            temp_posts.text_md = body.get('text_md')
            temp_posts.updated_date = timezone.now()
            temp_posts.save()
            return StatusDone()
        
        if request.method == 'DELETE':
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            temp_posts.delete()
            return StatusDone()

    raise Http404

def posts(request):
    if request.method == 'POST':
        if not request.user.is_active:
            return StatusError('NL')

        text_md = request.POST.get('text_md', '')
        text_html = parse_to_html(settings.SITE_URL, ParseData.from_dict({
            'text': text_md,
            'token': settings.API_KEY,
        }))

        post = Post()
        post.title = request.POST.get('title', '')
        post.author = request.user
        post.read_time = calc_read_time(text_html)

        series_url = request.POST.get('series', '')
        series = Series.objects.filter(
            owner=request.user,
            url=series_url
        )
        if series.exists():
            post.series = series.first()
        
        try:
            post.image = request.FILES['image']
        except:
            pass
        
        post.tag = ''
        post.url = slugify(post.title, allow_unicode=True)
        if post.url == '':
            post.url = randstr(15)
        i = 1
        while True:
            try:
                post.save()
                post.set_tags(request.POST.get('tag', ''))
                break
            except:
                if i > 1000:
                    traceback.print_exc()
                    return StatusError('TO', '일시적으로 오류가 발생했습니다.')
                post.url = slugify(f'{post.title}-{i}', allow_unicode=True)
                i += 1
        
        post_content = PostContent(posts=post)
        post_content.text_md = text_md
        post_content.text_html = text_html
        post_content.save()

        post_config = PostConfig(posts=post)
        post_config.hide = BooleanType(request.POST.get('is_hide', ''))
        post_config.advertise = BooleanType(request.POST.get('is_advertise', ''))
        post_config.save()

        token = request.POST.get('token')
        if token:
            try:
                TempPosts.objects.get(token=token, author=request.user).delete()
            except:
                pass
        return StatusDone({
            'url': post.url,
        })

    raise Http404

def top_trendy(request):
    if request.method == 'GET':
        seven_days_ago  = timezone.now() - datetime.timedelta(days=7)

        cache_key = 'top_trendy'
        posts = cache.get(cache_key)
        if not posts:
            posts = Post.objects.select_related(
                'config', 'content'
            ).filter(
                created_date__gte=seven_days_ago,
                created_date__lte=timezone.now(),
                config__notice=False,
                config__hide=False,
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            )
            posts = sorted(posts, key=lambda instance: instance.trendy(), reverse=True)[:6]
            cache.set(cache_key, posts, 7200)

        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts))
        })
    raise Http404

def popular_posts(request):
    if request.method == 'GET':
        cache_key = 'popular_posts'
        posts = cache.get(cache_key)
        if not posts:
            posts = Post.objects.select_related(
                'config', 'content'
            ).filter(
                created_date__lte=timezone.now(),
                config__notice=False,
                config__hide=False,
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            )
            posts = sorted(posts, key=lambda instance: instance.trendy(), reverse=True)
            cache.set(cache_key, posts, 7200)

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.description(),
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })

def newest_posts(request):
    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config', 'content'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        ).order_by('-created_date')

        posts = Paginator(
            objects=posts,
            offset=24,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.description(),
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })

def feature_posts(request, tag=None):
    if not tag:
        username = request.GET.get('username', '')
        if '@' in username:
            username = username.replace('@', '')
        if not username:
            raise Http404('require username.')
        
        posts = Post.objects.select_related(
            'config'
        ).filter(
            created_date__lte=timezone.now(),
            config__hide=False,
            author__username=username
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        )
        exclude = request.GET.get('exclude', '')
        if exclude:
            posts = posts.exclude(url=exclude)
        posts = posts.order_by('?')[:3]
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts))
        })

    if tag:
        posts = Post.objects.select_related(
            'config'
        ).filter(
            created_date__lte=timezone.now(),
            tags__value=tag,
            config__hide=False,
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        )
        exclude = request.GET.get('exclude', '')
        if exclude:
            posts = posts.exclude(url=exclude)
        posts = posts.order_by('?')[:3]
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.advertise,
            }, posts))
        })

def posts_comments(request, url):
    if request.method == 'GET':
        comments = Comment.objects.select_related(
            'author',
            'author__profile'
        ).annotate(
            total_likes=Count('likes'),
            is_liked=Case(
                When(
                    Exists(
                        Comment.objects.filter(
                            id=OuterRef('id'),
                            likes__id=request.user.id if request.user.id else -1
                        )
                    ),
                    then=Value(True)
                ),
                default=Value(False),
            )
        ).filter(post__url=url).order_by('created_date')
        
        return StatusDone({
            'comments': list(map(lambda comment: {
                'pk': comment.pk,
                'author': comment.author_username(),
                'author_image': comment.author_thumbnail(),
                'is_edited': comment.edited,
                'text_html': comment.get_text_html(),
                'time_since': timesince(comment.created_date),
                'total_likes': comment.total_likes,
                'is_liked': comment.is_liked,
            }, comments))
        })

def posts_analytics(request, url):
    post = get_object_or_404(Post, url=url)
    if request.method == 'GET':
        if request.user != post.author:
            raise Http404
        
        seven_days_ago  = timezone.now() - datetime.timedelta(days=7)
        
        posts_analytics = PostAnalytics.objects.values(
            'created_date'
        ).filter(
            posts__id=post.pk,
            created_date__gt=seven_days_ago
        ).annotate(
            table_count=Count('table')
        ).order_by('-created_date')

        date_dict = dict()
        for i in range(7):
            key = str(convert_to_localtime(timezone.now() - datetime.timedelta(days=i)))[:10]
            date_dict[key] = 0
        
        for item in posts_analytics:
            key = str(item['created_date'])[:10]
            date_dict[key] = item['table_count']

        posts_referers = Referer.objects.filter(
            posts__posts__id=post.pk,
            created_date__gt=seven_days_ago
        ).select_related(
            'referer_from'
        ).order_by('-created_date')[:30]

        data = {
            'items': [],
            'referers': [],
        }
        for item in date_dict:
            data['items'].append({
                'date': item,
                'count': date_dict[item]
            })
        for referer in posts_referers:
            data['referers'].append({
                'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                'from': referer.referer_from.location,
                'title': referer.referer_from.title
            })
        return StatusDone(data)

    if request.method == 'POST':
        ip = request.POST.get('ip', '')
        user_agent = request.POST.get('user_agent', '')
        referer = request.POST.get('referer', '')
        time = request.POST.get('time', '')

        view_count(post, request, ip, user_agent, referer)
        
        return StatusDone()

def user_posts(request, username, url=None):
    if not url:
        if request.method == 'GET':
            posts = Post.objects.select_related(
                'config', 'content'
            ).filter(
                created_date__lte=timezone.now(),
                author__username=username,
                config__hide=False
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            )
            all_count = posts.count()
            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tags__value=tag)
            posts = posts.order_by('-created_date')
            
            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'all_count': all_count,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'read_time': post.read_time,
                    'description': post.description(35),
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                    'author_image': post.author_image,
                    'author': post.author_username,
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                }, posts)),
                'last_page': posts.paginator.num_pages
            })
    if url:
        post = get_object_or_404(Post.objects.select_related(
            'config', 'content'
        ).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            series_url=F('series__url'),
        ), author__username=username, url=url)

        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                fn.compere_user(request.user, post.author, give_404_if='different')
                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'series': post.series_url if post.series_url else None,
                    'text_md': post.content.text_md,
                    'tags': post.tagging(),
                    'is_hide': post.config.hide,
                    'is_advertise': post.config.advertise
                })

            if request.GET.get('mode') == 'view':
                if post.config.hide and request.user != post.author:
                    raise Http404
                
                return StatusDone({
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'description': post.description(document_for='seo'),
                    'read_time': post.read_time,
                    'series': post.series_url if post.series_url else None,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': str(post.author_image),
                    'author': post.author_username,
                    'text_html': post.content.text_html,
                    'total_likes': post.total_likes(),
                    'total_comment': post.total_comment(),
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                    'is_liked': post.likes.filter(user__id=request.user.id).exists()
                })

        if request.method == 'POST':
            fn.compere_user(request.user, post.author, give_404_if='different')

            text_md = request.POST.get('text_md', '')
            text_html = parse_to_html(settings.SITE_URL, ParseData.from_dict({
                'text': text_md,
                'token': settings.API_KEY,
            }))

            post.title = request.POST.get('title', '')
            post.updated_date = timezone.now()
            post.read_time = calc_read_time(text_html)

            series_url = request.POST.get('series', '')
            if not series_url:
                post.series = None
            else:
                series = Series.objects.filter(
                    owner=request.user,
                    url=series_url
                )
                if series.exists():
                    post.series = series.first()
            
            try:
                post.image = request.FILES['image']
            except:
                pass
            
            post_content = post.content
            post_content.text_md = request.POST.get('text_md', '')
            post_content.text_html = text_html
            post_content.save()
            
            post_config = post.config
            post_config.hide = BooleanType(request.POST.get('is_hide', ''))
            post_config.advertise = BooleanType(request.POST.get('is_advertise', ''))
            post_config.save()

            post.save()
            post.set_tags(request.POST.get('tag', ''))

            return StatusDone()

        if request.method == 'PUT':
            put = QueryDict(request.body)
            if request.GET.get('like', ''):
                if not request.user.is_active:
                    return StatusError('NL')
                if request.user == post.author:
                    return StatusError('SU')
                user = User.objects.get(username=request.user)
                post_like = post.likes.filter(user=user)
                if post_like.exists():
                    post_like.delete()
                else:
                    PostLikes(post=post, user=user).save()
                    send_notify_content = '\''+ post.title +'\'글을 @'+ user.username +'님께서 추천했습니다.'
                    create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
                return StatusDone({
                    'total_likes': post.total_likes()
                })
            if request.GET.get('thanks', ''):
                if request.user == post.author:
                    return StatusError('SU')
                user_addr = get_network_addr(request)
                user_agent = request.META['HTTP_USER_AGENT']
                history = create_history(user_addr, user_agent)
                
                post_nothanks = post.nothanks.filter(history=history)
                if post_nothanks.exists():
                    post_nothanks.delete()

                post_thanks = post.thanks.filter(history=history)
                if not post_thanks.exists():
                    PostThanks(post=post, history=history).save()

                return StatusDone()
            if request.GET.get('nothanks', ''):
                if request.user == post.author:
                    return StatusError('SU')
                user_addr = get_network_addr(request)
                user_agent = request.META['HTTP_USER_AGENT']
                history = create_history(user_addr, user_agent)

                post_thanks = post.thanks.filter(history=history)
                if post_thanks.exists():
                    post_thanks.delete()

                post_nothanks = post.nothanks.filter(history=history)
                if not post_nothanks.exists():
                    PostNoThanks(post=post, history=history).save()
                
                return StatusDone()
            if request.GET.get('hide', ''):
                fn.compere_user(request.user, post.author, give_404_if='different')
                post.config.hide = not post.config.hide
                post.config.save()
                return StatusDone({
                    'is_hide': post.config.hide
                })
            if request.GET.get('tag', ''):
                fn.compere_user(request.user, post.author, give_404_if='different')
                post.set_tags(put.get('tag'))
                return StatusDone({
                    'tag': ','.join(post.tagging())
                })
            if request.GET.get('series', ''):
                fn.compere_user(request.user, post.author, give_404_if='different')
                post.series = None
                post.save()
                return StatusDone()
        
        if request.method == 'DELETE':
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.delete()
            return StatusDone()
    
    raise Http404