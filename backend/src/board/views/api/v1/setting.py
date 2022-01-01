import time

from django.core.paginator import Paginator
from django.db.models import Q, F, Count, Case, When
from django.http import JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.timesince import timesince

from board.models import *
from modules.requests import BooleanType
from modules.response import StatusDone, StatusError
from board.views import function as fn

def setting(request, item):
    if not request.user.is_active:
        return StatusError('NL')

    user = get_object_or_404(
        User.objects.select_related('config'),
        username=request.user
    )
    
    if request.method == 'GET':
        if item == 'notify':
            seven_days_ago = timezone.now() - datetime.timedelta(days=7)
            notify = Notify.objects.filter(user=user).filter(Q(created_date__gt=seven_days_ago) | Q(is_read=False)).order_by('-created_date')
            
            return StatusDone({
                'notify': list(map(lambda item: {
                    'pk': item.pk,
                    'url': item.url,
                    'is_read': item.is_read,
                    'content': item.infomation,
                    'created_date': timesince(item.created_date)
                }, notify)),
                'is_telegram_sync': request.user.config.has_telegram_id()
            })
        
        if item == 'account':
            return StatusDone({
                'username': user.username,
                'realname': user.first_name,
                'created_date': convert_to_localtime(user.date_joined).strftime('%Y년 %m월 %d일'),
                'email': user.email,
                'show_email': user.config.show_email,
                'agree_email': user.config.agree_email,
                'agree_history': user.config.agree_history
            })
        
        if item == 'profile':
            profile = Profile.objects.get(user=user)
            return StatusDone({
                'avatar': profile.get_thumbnail(),
                'bio': profile.bio,
                'homepage': profile.homepage,
                'github': profile.github,
                'twitter': profile.twitter,
                'youtube': profile.youtube,
                'facebook': profile.facebook,
                'instagram': profile.instagram
            })
        
        if item == 'posts':
            posts = Post.objects.select_related(
                'config'
            ).filter(
                author=user
            ).order_by('-created_date')

            return StatusDone(list(map(lambda post: {
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
            }, posts.iterator())))
        
        if item == 'series':
            series = Series.objects.filter(owner=user).order_by('index', '-id')
            return StatusDone({
                'username': user.username,
                'series': list(map(lambda item: {
                    'url': item.url,
                    'title': item.name,
                    'total_posts': item.posts.count()
                }, series))
            })
        
        if item == 'analytics-view':
            seven_days_ago = convert_to_localtime(timezone.now() - datetime.timedelta(days=30))

            posts_analytics = PostAnalytics.objects.values(
                'created_date',
            ).annotate(
                table_count=Count('table'),
            ).filter(
                posts__author=user,
                created_date__gt=seven_days_ago,
            ).order_by('-created_date')

            date_dict = dict()
            for i in range(30):
                key = str(convert_to_localtime(timezone.now() - datetime.timedelta(days=i)))[:10]
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
        
        if item == 'analytics-referer':
            a_month_ago = timezone.now() - datetime.timedelta(days=7)

            referers = RefererFrom.objects.filter(
                referers__posts__posts__author=user,
                referers__created_date__gt=a_month_ago,
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
                }, referers))
            })
        
        if item == 'analytics-search':
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
                    key=lambda x : x[1],
                    reverse=True
                )
            )

            top_searches = []

            for item in sorted(search_counter.items(), key=lambda x : x[1], reverse=True)[:10]:
                [ keyword, platform ] = item[0].split(' - ')
                top_searches.append({
                    'keyword': keyword,
                    'platform': platform,
                    'count': item[1],
                })
        
            return StatusDone({
                'platform_total': platform_total,
                'top_searches': top_searches,
            })
        
        if item == 'forms':
            user_forms = Form.objects.filter(user=request.user)
            return StatusDone({
                'forms': list(map(lambda form: {
                    'id': form.id,
                    'title': form.title,
                    'created_date': convert_to_localtime(form.created_date),
                }, user_forms))
            })
     
    if request.method == 'POST':
        if item == 'avatar':
            profile = Profile.objects.get(user=user)
            profile.avatar = request.FILES['avatar']
            profile.save()
            return StatusDone({
                'url': profile.get_thumbnail(),
            })

    if request.method == 'PUT':
        put = QueryDict(request.body)

        if item == 'notify':
            pk = put.get('pk')
            notify = Notify.objects.get(pk=pk)
            notify.is_read = True
            notify.save()
            return StatusDone()
        
        if item == 'account':
            should_update = False
            realname = put.get('realname', '')
            password = put.get('password', '')
            if realname and user.first_name != realname:
                user.first_name = realname
                should_update = True
            if password:
                user.set_password(password)
                auth.login(request, user)
                should_update = True
            if should_update:
                user.save()
            
            config_names = [
                'show_email',
                'agree_email',
                'agree_history',
            ]
            for config_name in config_names:
                setattr(user.config, config_name, BooleanType(put.get(config_name, '')))

            user.config.save()
            return StatusDone()
        
        if item == 'profile':
            profile = Profile.objects.get(user=user)

            req_data = dict()
            socials = [
                'bio',
                'homepage',
                'github',
                'twitter',
                'facebook',
                'instagram',
                'youtube'
            ]
            for social in socials:
                setattr(profile, social, put.get(social, ''))
            
            profile.save()
            return StatusDone()
    
    raise Http404