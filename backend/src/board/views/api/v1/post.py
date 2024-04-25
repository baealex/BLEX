import datetime

from django.conf import settings
from django.db.models import (
    F, Case, Exists, When, Subquery,
    Value, OuterRef, Count)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.text import slugify

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    Comment, Referer, PostAnalytics, Series,
    TempPosts, Post, PostContent, PostConfig, Invitation,
    PostLikes, PostThanks, PostNoThanks, calc_read_time)
from board.modules.analytics import create_device, get_network_addr, view_count
from board.modules.notify import create_notify
from board.modules.paginator import Paginator
from board.modules.post_description import create_post_description
from board.modules.requests import BooleanType
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_since
from modules import markdown
from modules.sub_task import SubTaskProcessor
from modules.discord import Discord


def post_list(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404

        if not Invitation.objects.filter(receiver=request.user).exists(): 
            return StatusError(ErrorCode.VALIDATE, '작성 권한이 없습니다.')

        title = request.POST.get('title', '')
        text_md = request.POST.get('text_md', '')

        if not title:
            return StatusError(ErrorCode.VALIDATE, '제목을 입력해주세요.')
        if not text_md:
            return StatusError(ErrorCode.VALIDATE, '내용을 입력해주세요.')

        text_html = markdown.parse_to_html(settings.API_URL, markdown.ParseData.from_dict({
            'text': text_md,
            'token': settings.API_KEY,
        }))
        read_time = calc_read_time(text_html)

        post = Post()
        post.title = title
        post.author = request.user
        post.read_time = read_time

        description = request.POST.get('description', '')
        if description:
            post.meta_description = request.POST.get('description', '')
        else:
            post.meta_description = create_post_description(
                post_content_html=text_html, write_type='general')

        reserved_date = request.POST.get('reserved_date', '')
        if reserved_date:
            reserved_date = parse_datetime(reserved_date)
            if reserved_date < timezone.now():
                return StatusError(ErrorCode.VALIDATE, '예약시간이 현재시간보다 이전입니다.')
            post.created_date = reserved_date
            post.updated_date = reserved_date

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

        url = request.POST.get('url', '')
        if url:
            url = slugify(url, allow_unicode=True)
        else:
            url = slugify(post.title, allow_unicode=True)

        post.create_unique_url(url)
        post.save()

        post.set_tags(request.POST.get('tag', ''))

        post_content = PostContent.objects.create(
            post=post,
            text_md=text_md,
            text_html=text_html
        )

        post_config = PostConfig.objects.create(
            post=post,
            hide=BooleanType(request.POST.get('is_hide', '')),
            advertise=BooleanType(request.POST.get('is_advertise', ''))
        )

        if not post_config.hide and post.is_published() and settings.DISCORD_NEW_POSTS_WEBHOOK:
            def func():
                post_url = settings.SITE_URL + post.get_absolute_url()
                Discord.send_webhook(
                    url=settings.DISCORD_NEW_POSTS_WEBHOOK,
                    content=f'[새 글이 발행되었어요!]({post_url})'
                )
            SubTaskProcessor.process(func)

        token = request.POST.get('token')
        if token:
            try:
                TempPosts.objects.get(
                    token=token, author=request.user).delete()
            except:
                pass
        return StatusDone({
            'url': post.url,
        })

    raise Http404


def trending_post_list(request):
    if request.method == 'GET':
        posts = Post.objects.select_related(
            'author', 'author__profile', 'config'
        ).prefetch_related(
            'comments'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
        ).annotate(
            today_count=Subquery(
                PostAnalytics.objects.filter(
                    post__id=OuterRef('id'),
                    created_date=timezone.now(),
                ).values('post__id').annotate(
                    count=Count('devices')
                ).values('count')
            ),
        ).order_by('-today_count', '-created_date')

        posts = Paginator(
            objects=posts,
            offset=5,
            page=1
        )
        return StatusDone(list(map(lambda post: {
            'url': post.url,
            'title': post.title,
            'image': str(post.image),
            'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
            'author_image': post.author.profile.get_thumbnail(),
            'author': post.author.username,
        }, posts)))


def newest_post_list(request):
    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config', 'series'
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
                'description': post.meta_description,
                'read_time': post.read_time,
                'created_date': post.time_since(),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
                'series': {
                    'url': post.series.url,
                    'name': post.series.name,
                } if post.series else None,
                'count_likes': post.count_likes,
                'count_comments': post.count_comments,
                'has_liked': post.has_liked,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })


def liked_post_list(request):
    if not request.user.id:
        raise Http404

    if request.method == 'GET':
        posts = Post.objects.select_related(
            'config', 'series'
        ).filter(
            created_date__lte=timezone.now(),
            config__notice=False,
            config__hide=False,
            likes__user=request.user,
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
            liked_date=Subquery(
                PostLikes.objects.filter(
                    post__id=OuterRef('id'),
                    user__id=request.user.id if request.user.id else -1
                ).values('created_date')[:1]
            ),
        ).order_by('-liked_date')

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
                'description': post.meta_description,
                'read_time': post.read_time,
                'liked_date': time_since(post.liked_date),
                'created_date': post.time_since(),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
                'series': {
                    'url': post.series.url,
                    'name': post.series.name,
                } if post.series else None,
                'count_likes': post.count_likes,
                'count_comments': post.count_comments,
                'has_liked': post.has_liked,
            }, posts)),
            'last_page': posts.paginator.num_pages
        })


def feature_post_list(request):
    if request.method == 'GET':
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
                'description': post.meta_description,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'is_ad': post.config.advertise,
            }, posts))
        })

    raise Http404


def post_comment_list(request, url):
    if request.method == 'GET':
        comments = Comment.objects.select_related(
            'author',
            'author__profile'
        ).annotate(
            count_likes=Count('likes', distinct=True),
            has_liked=Case(
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
                'id': comment.id,
                'author': comment.author_username(),
                'author_image': comment.author_thumbnail(),
                'is_edited': comment.edited,
                'rendered_content': comment.get_text_html(),
                'created_date': comment.time_since(),
                'count_likes': comment.count_likes,
                'is_liked': comment.has_liked,
            }, comments))
        })


def post_analytics(request, url):
    post = get_object_or_404(Post, url=url)
    if request.method == 'GET':
        if request.user != post.author:
            raise Http404

        seven_days = 7
        seven_days_ago = timezone.now() - datetime.timedelta(days=7)

        posts_views = PostAnalytics.objects.values(
            'created_date'
        ).filter(
            post__id=post.pk,
            created_date__gt=seven_days_ago
        ).annotate(
            table_count=Count('devices')
        ).order_by('-created_date')

        date_dict = dict()
        for i in range(seven_days):
            key = str(convert_to_localtime(
                timezone.now() - datetime.timedelta(days=i)))[:10]
            date_dict[key] = 0

        for item in posts_views:
            key = str(item['created_date'])[:10]
            date_dict[key] = item['table_count']

        posts_referers = Referer.objects.filter(
            post__id=post.pk,
            created_date__gt=seven_days_ago
        ).select_related(
            'referer_from'
        ).order_by('-created_date')[:30]

        one_month_ago = timezone.now() - datetime.timedelta(days=30)

        post_thanks = PostThanks.objects.filter(
            post=post,
            created_date__gt=one_month_ago
        ).count()
        post_no_thanks = PostNoThanks.objects.filter(
            post=post,
            created_date__gt=one_month_ago
        ).count()

        return StatusDone({
            'items': list(map(lambda item: {
                'date': item,
                'count': date_dict[item]
            }, date_dict)),
            'referers': list(map(lambda referer: {
                'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                'from': referer.referer_from.location,
                'title': referer.referer_from.title
            }, posts_referers)),
            'thanks': {
                'positive_count': post_thanks,
                'negative_count': post_no_thanks,
            }
        })

    if request.method == 'POST':
        view_count(
            post=post,
            request=request,
            ip=request.POST.get('ip', ''),
            user_agent=request.POST.get('user_agent', ''),
            referer=request.POST.get('referer', ''))
        return StatusDone()


def user_posts(request, username, url=None):
    if not url:
        if request.method == 'GET':
            posts = Post.objects.select_related(
                'config', 'content',
            ).filter(
                created_date__lte=timezone.now(),
                author__username=username,
                config__hide=False,
            ).annotate(
                author_username=F('author__username'),
                author_image=F('author__profile__avatar'),
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
                    'description': post.meta_description,
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
            'config', 'content', 'series'
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
        ), author__username=username, url=url)

        if request.method == 'GET':
            if request.GET.get('mode') == 'edit':
                if not request.user == post.author:
                    raise Http404

                return StatusDone({
                    'image': post.get_thumbnail(),
                    'title': post.title,
                    'description': post.meta_description,
                    'series': {
                        'url': post.series.url,
                        'name': post.series.name,
                    } if post.series else None,
                    'text_md': post.content.text_md,
                    'tags': post.tagging(),
                    'is_hide': post.config.hide,
                    'is_advertise': post.config.advertise
                })

            if request.GET.get('mode') == 'view':
                if post.config.hide and request.user != post.author:
                    raise Http404

                if not post.is_published() and request.user != post.author:
                    raise Http404

                return StatusDone({
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'description': post.meta_description,
                    'read_time': post.read_time,
                    'series': {
                        'url': post.series.url,
                        'name': post.series.name,
                    } if post.series else None,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d %H:%M'),
                    'author_image': str(post.author_image),
                    'author': post.author_username,
                    'rendered_content': post.content.text_html,
                    'count_likes': post.count_likes,
                    'count_comments': post.count_comments,
                    'is_ad': post.config.advertise,
                    'tags': post.tagging(),
                    'is_liked': post.has_liked,
                })

        if request.method == 'POST':
            if not request.user == post.author:
                raise Http404

            title = request.POST.get('title', '')
            text_md = request.POST.get('text_md', '')

            if not title:
                return StatusError(ErrorCode.VALIDATE, '제목을 입력해주세요.')
            if not text_md:
                return StatusError(ErrorCode.VALIDATE, '내용을 입력해주세요.')

            text_html = markdown.parse_to_html(settings.API_URL, markdown.ParseData.from_dict({
                'text': text_md,
                'token': settings.API_KEY,
            }))
            read_time = calc_read_time(text_html)

            post.title = title
            post.read_time = read_time

            description = request.POST.get('description', '')
            if description:
                post.meta_description = description

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
            post_config.advertise = BooleanType(
                request.POST.get('is_advertise', ''))
            post_config.save()

            if post.is_published():
                post.updated_date = timezone.now()

            post.save()
            post.set_tags(request.POST.get('tag', ''))

            return StatusDone()

        if request.method == 'PUT':
            put = QueryDict(request.body)

            if request.GET.get('like', ''):
                if not request.user.id:
                    return StatusError(ErrorCode.NEED_LOGIN)

                if post.has_liked:
                    PostLikes.objects.filter(post=post, user=request.user).delete()
                    return StatusDone({
                        'count_likes': post.count_likes - 1,
                    })
                else:
                    PostLikes(post=post, user=request.user).save()
                    if request.user != post.author and post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_LIKE):
                        send_notify_content = (
                            f"'{post.title}' 글을 "
                            f"@{request.user.username}님께서 추천하였습니다.")
                        create_notify(
                            user=post.author,
                            url=post.get_absolute_url(),
                            content=send_notify_content)
                    return StatusDone({
                        'count_likes': post.count_likes + 1,
                    })

            if request.GET.get('thanks', ''):
                if request.user == post.author:
                    return StatusError(ErrorCode.AUTHENTICATION)
                user_addr = get_network_addr(request)
                user_agent = request.META['HTTP_USER_AGENT']
                device = create_device(user_addr, user_agent)

                post_nothanks = post.nothanks.filter(device=device)
                if post_nothanks.exists():
                    post_nothanks.delete()

                post_thanks = post.thanks.filter(device=device)
                if not post_thanks.exists():
                    if post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_THANKS):
                        send_notify_content = (
                            f"'{post.title}' 글을 "
                            f"누군가 도움이 되었다고 평가하였습니다.")
                        create_notify(
                            user=post.author,
                            url=post.get_absolute_url(),
                            content=send_notify_content,
                            hidden_key=device.key)
                    PostThanks(post=post, device=device).save()

                return StatusDone()

            if request.GET.get('nothanks', ''):
                if request.user == post.author:
                    return StatusError(ErrorCode.AUTHENTICATION)
                user_addr = get_network_addr(request)
                user_agent = request.META['HTTP_USER_AGENT']
                device = create_device(user_addr, user_agent)

                post_thanks = post.thanks.filter(device=device)
                if post_thanks.exists():
                    post_thanks.delete()

                post_nothanks = post.nothanks.filter(device=device)
                if not post_nothanks.exists():
                    if post.author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS):
                        send_notify_content = (
                            f"'{post.title}' 글을 "
                            f"누군가 도움이 되지 않았다고 평가하였습니다.")
                        create_notify(
                            user=post.author,
                            url=post.get_absolute_url(),
                            content=send_notify_content,
                            hidden_key=device.key)
                    PostNoThanks(post=post, device=device).save()

                return StatusDone()

            if request.GET.get('hide', ''):
                if not request.user == post.author:
                    raise Http404

                post.config.hide = not post.config.hide
                post.config.save()
                return StatusDone({
                    'is_hide': post.config.hide
                })

            if request.GET.get('tag', ''):
                if not request.user == post.author:
                    raise Http404

                post.set_tags(put.get('tag'))
                return StatusDone({
                    'tag': ','.join(post.tagging())
                })

            if request.GET.get('series', ''):
                if not request.user == post.author:
                    raise Http404

                series_url = put.get('series')
                if not series_url:
                    post.series = None
                    post.save()
                    return StatusDone({
                        'series': None
                    })

                series = Series.objects.filter(
                    owner=request.user,
                    url=series_url
                )
                if series.exists():
                    post.series = series.first()
                else:
                    post.series = None
                post.save()
                return StatusDone({
                    'series': post.series.url if post.series else None
                })

            if request.GET.get('reserved_date', ''):
                if not request.user == post.author:
                    raise Http404
                reserved_date = put.get('reserved_date')
                if reserved_date and not post.is_published():
                    post.created_date = parse_datetime(reserved_date)
                    post.updated_date = parse_datetime(reserved_date)
                    post.save()
                return StatusDone()

        if request.method == 'DELETE':
            if not request.user == post.author:
                raise Http404
            post.delete()
            return StatusDone()

    raise Http404
