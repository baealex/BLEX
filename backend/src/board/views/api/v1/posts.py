from django.core.paginator import Paginator
from django.db.models import F, Q, Case, When, Value
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from django.utils.timesince import timesince

from board.models import *
from board.module.response import StatusDone, StatusError
from board.module.analytics import view_count
from board.views import function as fn

def temp_posts(request):
    if not request.user.is_active:
        return HttpResponse('error:NL')

    if request.method == 'GET':
        token = request.GET.get('token')
        if token:
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            return StatusDone({
                'title': temp_posts.title,
                'token': temp_posts.token,
                'text_md': temp_posts.text_md,
                'tag': temp_posts.tag,
                'created_date': timesince(temp_posts.created_date),
            })

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
        if temps >= 20:
            return HttpResponse('error:OF')
        
        body = QueryDict(request.body)

        token = randstr(25)
        has_token = TempPosts.objects.filter(token=token, author=request.user)
        while len(has_token) > 0:
            token = randstr(25)
            has_token = TempPosts.objects.filter(token=token, author=request.user)
        
        temp_posts = TempPosts(token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()

        return StatusDone({
            'token': token
        })
    
    if request.method == 'PUT':
        body = QueryDict(request.body)
        token = body.get('token')
        temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()
        return StatusDone()
    
    if request.method == 'DELETE':
        body = QueryDict(request.body)
        token = body.get('token')
        temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
        temp_posts.delete()
        return StatusDone()

    raise Http404

def posts(request):
    if request.method == 'GET':
        sort = request.GET.get('sort', 'trendy')
        posts = fn.get_posts(sort)

        page = request.GET.get('page', 1)
        paginator = Paginator(posts, 24)
        fn.page_check(page, paginator)
        posts = paginator.get_page(page)
        return StatusDone({
            'posts': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.description(),
                'read_time': post.read_time,
                'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })
    
    if request.method == 'POST':
        if not request.user.is_active:
            return StatusError('NL')

        post = Post()
        post.title = request.POST.get('title', '')
        post.author = request.user
        post.text_md = request.POST.get('text_md', '')
        post.text_html = request.POST.get('text_html', '')
        post.hide = True if request.POST.get('is_hide', '') == 'true' else False
        post.advertise = True if request.POST.get('is_advertise', '') == 'true' else False
        post.read_time = calc_read_time(post.text_html)

        try:
            series_url = request.POST.get('series', '')
            if series_url:
                series = Series.objects.get(owner=request.user, url=series_url)
                post.series = series
        except:
            pass

        try:
            post.image = request.FILES['image']
        except:
            pass
        
        post.tag = fn.get_clean_tag(request.POST.get('tag', ''))[:50]
        post.url = slugify(post.title, allow_unicode=True)
        if post.url == '':
            post.url = randstr(15)
        i = 1
        while True:
            try:
                post.save()
                break
            except:
                post.url = slugify(post.title+'-'+str(i), allow_unicode=True)
                i += 1

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

def feature_posts(request, tag=None):
    if not tag:
        username = request.GET.get('username', '')
        if '@' in username:
            username = username.replace('@', '')
        if not username:
            raise Http404('require username.')
        
        posts = Post.objects.filter(
            created_date__lte=timezone.now(),
            hide=False,
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
            }, posts))
        })

    if tag:
        posts = Post.objects.filter(
            created_date__lte=timezone.now(),
            tag__iregex=r'\b%s\b' % tag,
            hide=False,
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
                    likes__id=request.user.id if request.user.id else -1,
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
from board.module.query import query_debugger
@query_debugger
def posts_analytics(request, url):
    post = get_object_or_404(Post, url=url)
    if request.method == 'GET':
        if request.user != post.author:
            raise Http404
        
        seven_days_ago  = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7)))
        posts_analytics = PostAnalytics.objects.filter(
            posts__id=post.pk,
            created_date__gt=seven_days_ago
        ).annotate(
            table_count=Count('table')
        ).order_by('-created_date')
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
        for item in posts_analytics:
            data['items'].append({
                'date': item.created_date,
                'count': item.table_count
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
            posts = Post.objects.filter(
                created_date__lte=timezone.now(),
                author__username=username,
                hide=False
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar')
            )
            all_count = posts.count()
            tag = request.GET.get('tag', '')
            if tag:
                posts = posts.filter(tag__iregex=r'\b%s\b' % tag)
            posts = posts.order_by('-created_date')
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 10)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)
            return StatusDone({
                'all_count': all_count,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'read_time': post.read_time,
                    'description': post.description(35),
                    'created_date': post.created_date.strftime('%Y년 %m월 %d일'),
                    'author_image': post.author_username,
                    'author': post.author_image,
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages
            })
    if url:
        post = get_object_or_404(Post.objects.annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar')
        ), author__username=username, url=url)
        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                fn.compere_user(request.user, post.author, give_404_if='different')
                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'series': post.series.url if post.series else None,
                    'text_md': post.text_md,
                    'tag': post.tag,
                    'is_hide': post.hide,
                    'is_advertise': post.advertise
                })

            if request.GET.get('mode') == 'view':
                if post.hide and request.user != post.author:
                    raise Http404
                
                return StatusDone({
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'description': post.description_tag(),
                    'read_time': post.read_time,
                    'series': post.series.url if post.series else None,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': str(post.author_image),
                    'author': post.author_username,
                    'text_html': post.text_html,
                    'total_likes': post.total_likes(),
                    'total_comment': post.total_comment(),
                    'tag': post.tag,
                    'is_liked': post.likes.filter(user__id=request.user.id).exists()
                })

        if request.method == 'POST':
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.title = request.POST.get('title', '')
            post.text_md = request.POST.get('text_md', '')
            post.text_html = request.POST.get('text_html', '')
            post.hide = True if request.POST.get('is_hide', '') == 'true' else False
            post.advertise = True if request.POST.get('is_advertise', '') == 'true' else False
            post.updated_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now()))
            post.read_time = calc_read_time(post.text_html)

            try:
                series_url = request.POST.get('series', '')
                if series_url:
                    series = Series.objects.get(owner=request.user, url=series_url)
                    post.series = series
            except:
                pass
            
            try:
                post.image = request.FILES['image']
            except:
                pass

            post.tag = fn.get_clean_tag(request.POST.get('tag', ''))
            post.save()
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
                    fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
                return StatusDone({
                    'total_likes': post.total_likes()
                })
            if request.GET.get('hide', ''):
                fn.compere_user(request.user, post.author, give_404_if='different')
                post.hide = not post.hide
                post.save()
                return StatusDone({
                    'is_hide': post.hide
                })
            if request.GET.get('tag', ''):
                fn.compere_user(request.user, post.author, give_404_if='different')
                post.tag = fn.get_clean_tag(put.get('tag'))
                post.save()
                return StatusDone({
                    'tag': post.tag
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