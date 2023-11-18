import datetime

from django.contrib import auth
from django.db.models import (
    Q, F, Count, Case, When, Sum)
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, RefererFrom, Series, Post, UserLinkMeta,
    PostAnalytics, TempPosts, Profile, Notify,
    OpenAIConnection, OpenAIUsageHistory)
from board.modules.paginator import Paginator
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime


def setting(request, parameter):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    user = get_object_or_404(
        User.objects.select_related('config'),
        username=request.user
    )

    if request.method == 'GET':
        if parameter == 'notify':
            six_months_ago = timezone.now() - datetime.timedelta(days=180)
            notify = Notify.objects.filter(user=user).filter(
                Q(created_date__gt=six_months_ago) |
                Q(is_read=False)
            ).order_by('-created_date')

            return StatusDone({
                'notify': list(map(lambda item: {
                    'pk': item.pk,
                    'url': item.url,
                    'is_read': item.is_read,
                    'content': item.infomation,
                    'created_date': item.time_since()
                }, notify)),
                'is_telegram_sync': request.user.config.has_telegram_id()
            })
        
        if parameter == 'notify-config':
            configs = [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                CONFIG_TYPE.NOTIFY_POSTS_THANKS,
                CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_FOLLOW,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]
            return StatusDone({
                'config': list(map(lambda config: {
                    'name': config.value,
                    'value': user.config.get_meta(config)
                }, configs))
            })

        if parameter == 'account':
            return StatusDone({
                'username': user.username,
                'name': user.first_name,
                'email': user.email,
                'created_date': convert_to_localtime(user.date_joined).strftime('%Y년 %m월 %d일'),
            })

        if parameter == 'profile':
            profile = Profile.objects.get(user=user)
            return StatusDone({
                'avatar': profile.get_thumbnail(),
                'bio': profile.bio,
                'homepage': profile.homepage,
                'social': profile.collect_social(),
            })

        if parameter == 'posts':
            posts = Post.objects.select_related(
                'config'
            ).filter(
                author=user,
                created_date__lte=timezone.now(),
            ).order_by('-created_date')

            tag_filter = request.GET.get('tag_filter', '')
            if tag_filter:
                posts = posts.filter(tags__value=tag_filter)

            valid_orders = [
                'title',
                'read_time',
                'created_date',
                'updated_date',
                'total_like_count',
                'total_comment_count',
                'hide',
            ]
            order = request.GET.get('order', '')
            if order:
                is_valid = False
                for valid_order in valid_orders:
                    if order == valid_order or order == '-' + valid_order:
                        is_valid = True
                if not is_valid:
                    raise Http404

                if 'hide' in order:
                    posts = posts.annotate(
                        hide=F('config__hide'),
                    )
                if 'total_like_count' in order:
                    posts = posts.annotate(
                        total_like_count=Count('likes', distinct=True))
                if 'total_comment_count' in order:
                    posts = posts.annotate(
                        total_comment_count=Count('comments', distinct=True))

                posts = posts.order_by(order)

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
                    'is_hide': post.config.hide,
                    'total_likes': post.total_likes(),
                    'total_comments': post.total_comment(),
                    'today_count': post.today(),
                    'read_time': post.read_time,
                    'yesterday_count': post.yesterday(),
                    'tag': ','.join(post.tagging()),
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })

        if parameter == 'reserved-posts':
            posts = Post.objects.select_related(
                'config'
            ).filter(
                author=user,
                created_date__gt=timezone.now(),
            ).order_by('-created_date')

            valid_orders = [
                'title',
                'read_time',
                'created_date',
                'updated_date',
                'hide',
            ]
            order = request.GET.get('order', '')
            if order:
                is_valid = False
                for valid_order in valid_orders:
                    if order == valid_order or order == '-' + valid_order:
                        is_valid = True
                if not is_valid:
                    raise Http404

                if 'hide' in order:
                    posts = posts.annotate(
                        hide=F('config__hide'),
                    )

                posts = posts.order_by(order)

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d %H:%M'),
                    'is_hide': post.config.hide,
                    'today_count': post.today(),
                    'read_time': post.read_time,
                    'tag': ','.join(post.tagging()),
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })

        if parameter == 'temp-posts':
            posts = TempPosts.objects.filter(
                created_date__lte=timezone.now(),
                author=user,
            ).order_by('-created_date')

            posts = Paginator(
                objects=posts,
                offset=10,
                page=request.GET.get('page', 1)
            )
            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'token': post.token,
                    'title': post.title,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y-%m-%d'),
                    'updated_date': convert_to_localtime(post.updated_date).strftime('%Y-%m-%d'),
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })

        if parameter == 'series':
            series_items = Series.objects.filter(
                owner=user
            ).annotate(
                total_posts=Count('posts')
            ).order_by('order', '-id')
            return StatusDone({
                'username': user.username,
                'series': list(map(lambda series_item: {
                    'url': series_item.url,
                    'title': series_item.name,
                    'total_posts': series_item.total_posts
                }, series_items))
            })

        if parameter == 'analytics-posts-view':
            date = request.GET.get('date', timezone.now().strftime('%Y-%m-%d'))
            posts = Post.objects.filter(author=user).annotate(
                author_username=F('author__username'),
                today_count=Count(
                    Case(
                        When(
                            analytics__created_date=parse_datetime(date),
                            then='analytics__table'
                        )
                    )
                ),
                yesterday_count=Count(
                    Case(
                        When(
                            analytics__created_date=parse_datetime(
                                date) - datetime.timedelta(days=1),
                            then='analytics__table'
                        )
                    )
                )
            ).order_by('-today_count', '-yesterday_count', '-created_date')[:8]

            return StatusDone({
                'posts': list(map(lambda item: {
                    'id': item.id,
                    'url': item.url,
                    'title': item.title,
                    'author': item.author_username,
                    'today_count': item.today_count,
                    'increase_count': item.today_count - item.yesterday_count,
                }, posts))
            })

        if parameter == 'analytics-view':
            one_month = 30
            one_month_ago = convert_to_localtime(
                timezone.now() - datetime.timedelta(days=one_month))

            posts_analytics = PostAnalytics.objects.values(
                'created_date',
            ).annotate(
                table_count=Count('table'),
            ).filter(
                posts__author=user,
                created_date__gt=one_month_ago,
            ).order_by('-created_date')

            date_dict = dict()
            for i in range(one_month):
                key = str(convert_to_localtime(
                    timezone.now() - datetime.timedelta(days=i)))[:10]
                date_dict[key] = 0

            for item in posts_analytics:
                key = str(item['created_date'])[:10]
                date_dict[key] = item['table_count']

            total = PostAnalytics.objects.filter(
                posts__author=user
            ).annotate(
                table_count=Count('table'),
            ).aggregate(sum=Sum('table_count'))['sum']

            return StatusDone({
                'username': user.username,
                'views': list(map(lambda item: {
                    'date': item,
                    'count': date_dict[item]
                }, date_dict)),
                'total': total if total else 0
            })

        if parameter == 'analytics-referer':
            one_year_ago = timezone.now() - datetime.timedelta(days=365)

            referers = RefererFrom.objects.filter(
                referers__posts__posts__author=user,
                referers__created_date__gt=one_year_ago,
            ).annotate(
                posts_title=F('referers__posts__posts__title'),
                posts_author=F('referers__posts__posts__author__username'),
                posts_url=F('referers__posts__posts__url')
            ).exclude(
                Q(title__contains='검색') |
                Q(title__contains='Bing') |
                Q(title__contains='Google') |
                Q(title__contains='Search') |
                Q(title__contains='DuckDuckGo') |
                Q(location__contains='link.naver.com')
            ).order_by('-created_date').distinct()[:12]

            return StatusDone({
                'referers': list(map(lambda referer: {
                    'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                    'title': referer.title,
                    'url': referer.location,
                    'image': referer.image,
                    'description': referer.description,
                    'posts': {
                        'author': referer.posts_author,
                        'title': referer.posts_title,
                        'url': referer.posts_url
                    }
                }, referers))
            })

        if parameter == 'analytics-search':
            a_month_ago = timezone.now() - datetime.timedelta(days=30)

            referers = RefererFrom.objects.filter(
                referers__posts__posts__author=request.user,
            ).filter(
                Q(title__contains='검색') |
                Q(title__contains='Bing') |
                Q(title__contains='Google') |
                Q(title__contains='Search') |
                Q(title__contains='DuckDuckGo')
            ).annotate(
                count=Count(
                    Case(
                        When(
                            referers__created_date__gt=a_month_ago,
                            then='referers'
                        )
                    )
                )
            ).distinct()

            search_counter = {}
            platform_total = {
                '네이버': 0,
                '덕덕고': 0,
                '다음': 0,
                '구글': 0,
                '야후': 0,
                '빙': 0,
                '줌': 0,
            }

            for referer in referers:
                keyword = referer.title
                platform = ''

                if ' : 네이버 통합웹검색' in referer.title:
                    keyword = keyword.replace(' : 네이버 통합웹검색', '')
                    platform = '네이버'

                if ' : 네이버 통합검색' in referer.title:
                    keyword = keyword.replace(' : 네이버 통합검색', '')
                    platform = '네이버'

                if ' – Daum 검색' in referer.title:
                    keyword = keyword.replace(' – Daum 검색', '')
                    platform = '다음'

                if ' - Google 검색' in referer.title:
                    keyword = keyword.replace(' - Google 검색', '')
                    platform = '구글'

                if 'Google' == referer.title:
                    keyword = ''
                    platform = '구글'

                if 'DuckDuckGo' in referer.title:
                    keyword = ''
                    platform = '덕덕고'

                if 'Yahoo' in referer.title:
                    keyword = ''
                    platform = '야후'

                if ' - Bing' in referer.title:
                    keyword = keyword.replace(' - Bing', '')
                    platform = '빙'

                if ' : 검색줌' in referer.title:
                    keyword = keyword.replace(' : 검색줌', '')
                    platform = '줌'

                if not platform:
                    continue

                platform_total[platform] += referer.count

                if not keyword:
                    continue

                if f'{keyword} - {platform}' in search_counter:
                    search_counter[f'{keyword} - {platform}'] += referer.count
                    continue
                search_counter[f'{keyword} - {platform}'] = referer.count

            platform_total = dict(
                sorted(
                    filter(
                        lambda x: x[1] != 0,
                        platform_total.items()
                    ),
                    key=lambda x: x[1],
                    reverse=True
                )
            )

            top_searches = []

            for item in sorted(search_counter.items(), key=lambda x: x[1], reverse=True)[:10]:
                [keyword, platform] = item[0].split(' - ')
                top_searches.append({
                    'keyword': keyword,
                    'platform': platform,
                    'count': item[1],
                })

            return StatusDone({
                'platform_total': platform_total,
                'top_searches': top_searches,
            })

        if parameter == 'integration-telegram':
            if hasattr(request.user, 'telegramsync') and request.user.telegramsync.tid:
                return StatusDone({
                    'is_connected': True,
                    'telegram_id': request.user.telegramsync.tid.replace(request.user.telegramsync.tid[2:7], '*'.ljust(5, '*')),
                })
            return StatusDone({
                'is_connected': False,
            })

        if parameter == 'integration-openai':
            if hasattr(request.user, 'openaiconnection'):
                usage_histories = OpenAIUsageHistory.objects.filter(
                    user=request.user,
                    created_date__gt=timezone.now() - datetime.timedelta(days=30)
                ).order_by('-created_date')
                return StatusDone({
                    'is_connected': True,
                    'api_key': request.user.openaiconnection.api_key.replace(request.user.openaiconnection.api_key[3:27], '*'.ljust(24, '*')),
                    'usage_histories': list(map(lambda history: {
                        'id': history.id,
                        'query': history.query,
                        'response': history.response,
                        'created_date': history.created_date,
                    }, usage_histories))
                })
            return StatusDone({
                'is_connected': False,
            })

    if request.method == 'POST':
        if parameter == 'avatar':
            profile = Profile.objects.get(user=user)
            profile.avatar = request.FILES['avatar']
            profile.save()
            return StatusDone({
                'url': profile.get_thumbnail(),
            })

        if parameter == 'integration-openai':
            api_key = request.POST.get('api_key', '')
            if not api_key:
                return StatusError(ErrorCode.VALIDATE, 'API 키를 입력해주세요.')

            if hasattr(request.user, 'openaiconnection'):
                return StatusError(ErrorCode.ALREADY_CONNECTED, '이미 연동되어 있습니다.')

            OpenAIConnection.objects.create(
                user=request.user,
                api_key=api_key,
            )
            return StatusDone()

    if request.method == 'PUT':
        put = QueryDict(request.body)

        if parameter == 'notify':
            pk = put.get('pk')
            notify = Notify.objects.get(pk=pk)
            notify.is_read = True
            notify.save()
            return StatusDone()

        if parameter == 'notify-config':
            configs = [
                CONFIG_TYPE.NOTIFY_POSTS_LIKE,
                CONFIG_TYPE.NOTIFY_POSTS_COMMENT,
                CONFIG_TYPE.NOTIFY_POSTS_THANKS,
                CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS,
                CONFIG_TYPE.NOTIFY_COMMENT_LIKE,
                CONFIG_TYPE.NOTIFY_FOLLOW,
                CONFIG_TYPE.NOTIFY_MENTION,
            ]
            for config in configs:
                user.config.create_or_update_meta(
                    config, put.get(config, ''))

            return StatusDone()

        if parameter == 'account':
            should_update = False

            name = put.get('name', '')
            password = put.get('password', '')

            if name and user.first_name != name:
                user.first_name = name
                should_update = True

            if password:
                if len(password) < 8:
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 8자 이상이어야 합니다.')

                if not any(x.isdigit() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 숫자를 포함해야 합니다.')

                if not any(x.islower() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 소문자를 포함해야 합니다.')

                if not any(x.isupper() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 대문자를 포함해야 합니다.')

                if not any(not x.isupper() and not x.islower() and not x.isdigit() for x in password):
                    return StatusError(ErrorCode.VALIDATE, '비밀번호는 특수문자를 포함해야 합니다.')

                user.set_password(password)
                auth.login(request, user)
                should_update = True

            if should_update:
                user.save()

            return StatusDone()

        if parameter == 'profile':
            profile = Profile.objects.get(user=user)

            attrs = [
                'bio',
                'homepage',
            ]
            for attr in attrs:
                setattr(profile, attr, put.get(attr, ''))

            profile.save()
            return StatusDone()
    
        if parameter == 'social':
            update_items = put.get('update', '')
            for update_item in update_items.split('&'):
                if not update_item:
                    continue

                [id, name, value, order] = update_item.split(',')
                UserLinkMeta.objects.update_or_create(
                    user=user,
                    id=id,
                    defaults={
                        'name': name,
                        'value': value,
                        'order': order,
                    }
                )                
            
            create_items = put.get('create', '')
            for create_item in create_items.split('&'):
                if not create_item:
                    continue

                [name, value, order] = create_item.split(',')
                UserLinkMeta.objects.create(
                    user=user,
                    name=name,
                    value=value,
                    order=order,
                )

            delete_items = put.get('delete', '')
            for delete_item in delete_items.split('&'):
                if not delete_item:
                    continue

                UserLinkMeta.objects.filter(
                    user=user,
                    id=delete_item,
                ).delete()
            
            return StatusDone(user.profile.collect_social())

    if request.method == 'DELETE':
        if parameter == 'integration-openai':
            if not hasattr(request.user, 'openaiconnection'):
                return StatusError(ErrorCode.ALREADY_DISCONNECTED, '연동되어 있지 않습니다.')

            request.user.openaiconnection.delete()
            return StatusDone()

    raise Http404
