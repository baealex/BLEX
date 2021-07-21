import time

from django.core.paginator import Paginator
from django.db.models import Q, F, Count, Case, When
from django.http import JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.timesince import timesince

from board.models import *
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
                    'created_date': timesince(convert_to_localtime(item.created_date))
                }, notify)),
                'is_telegram_sync': request.user.config.has_telegram_id()
            })
        
        if item == 'account':
            return StatusDone({
                'username': user.username,
                'realname': user.first_name,
                'created_date': user.date_joined.strftime('%Y년 %m월 %d일'),
                'has_two_factor_auth': user.config.has_two_factor_auth(),
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
            posts = Post.objects.filter(author=user).order_by('-created_date')
            
            vaild_orders = [
                'title',
                'read_time',
                'created_date',
                'updated_date',
                'tag',
                'total_like_count',
                'total_comment_count',
                'hide',
                'today_count',
                'yesterday_count',
            ]
            order = request.GET.get('order', '')
            if order:
                is_vaild = False
                for vaild_order in vaild_orders:
                    if order == vaild_order or order == '-' + vaild_order:
                        is_vaild = True
                if not is_vaild:
                    raise Http404

                if 'today_count' in order:
                    today = timezone.now()
                    posts = posts.annotate(today_count=Count(
                        Case(
                            When(
                                analytics__created_date=today,
                                then='analytics__table'
                            )
                        )
                    ))
                if 'yesterday_count' in order:
                    yesterday = timezone.now() - datetime.timedelta(days=1)
                    posts = posts.annotate(yesterday_count=Count(
                        Case(
                            When(
                                 analytics__created_date=yesterday,
                                then='analytics__table'
                            )
                        )
                    ))
                if 'total_like_count' in order:
                    posts = posts.annotate(total_like_count=Count('likes', distinct=True))
                if 'total_comment_count' in order:
                    posts = posts.annotate(total_comment_count=Count('comments', distinct=True))
                
                try:
                    posts = posts.order_by(order)
                except:
                    pass

            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 10)
            fn.page_check(page, paginator)
            posts = paginator.get_page(page)

            return StatusDone({
                'username': request.user.username,
                'posts': list(map(lambda post: {
                    'url': post.url,
                    'title': post.title,
                    'created_date': post.created_date.strftime('%Y-%m-%d'),
                    'updated_date': post.updated_date.strftime('%Y-%m-%d'),
                    'is_hide': post.hide,
                    'total_likes': post.total_likes(),
                    'total_comments': post.total_comment(),
                    'today_count': post.today(),
                    'read_time': post.read_time,
                    'yesterday_count': post.yesterday(),
                    'tag': post.tag,
                }, posts)),
                'last_page': posts.paginator.num_pages,
            })
        
        if item == 'series':
            series = Series.objects.filter(owner=user).order_by('-created_date')
            return StatusDone({
                'username': user.username,
                'series': list(map(lambda item: {
                    'url': item.url,
                    'title': item.name,
                    'total_posts': item.posts.count()
                }, series))
            })
        
        if item == 'view':
            seven_days_ago = convert_to_localtime(timezone.now() - datetime.timedelta(days=7))

            posts_analytics = PostAnalytics.objects.values(
                'created_date',
            ).annotate(
                table_count=Count('table'),
            ).filter(
                posts__author=user,
                created_date__gt=seven_days_ago,
            ).order_by('-created_date')

            date_dict = dict()
            for i in range(7):
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
                'total': total
            })
        
        if item == 'referer':
            referers = RefererFrom.objects.filter(
                referers__posts__posts__author=user
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
        
        if item == 'forms':
            user_forms = Form.objects.filter(user=request.user)
            return StatusDone({
                'forms': list(map(lambda form: {
                    'id': form.id,
                    'title': form.title,
                    'created_date': form.created_date,
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
            
            user.config.agree_email = True if put.get('agree_email', '') == 'true' else False
            user.config.agree_history = True if put.get('agree_history', '') == 'true' else False
            user.config.save()
            return StatusDone()
        
        if item == 'profile':
            req_data = dict()
            items = [
                'bio',
                'homepage',
                'github',
                'twitter',
                'facebook',
                'instagram',
                'youtube'
            ]
            for item in items:
                req_data[item] = put.get(item, '')
            
            # TODO: QuerySet의 attr을 dict처럼 가져오는 방법 모색
            profile = Profile.objects.get(user=user)
            if profile.bio != req_data['bio']:
                profile.bio = req_data['bio']
            if profile.homepage != req_data['homepage']:
                profile.homepage = req_data['homepage']
            if profile.github != req_data['github']:
                profile.github = req_data['github']
            if profile.twitter != req_data['twitter']:
                profile.twitter = req_data['twitter']
            if profile.facebook != req_data['facebook']:
                profile.facebook = req_data['facebook']
            if profile.instagram != req_data['instagram']:
                profile.instagram = req_data['instagram']
            if profile.youtube != req_data['youtube']:
                profile.youtube = req_data['youtube']
            profile.save()
            return StatusDone()
    
    raise Http404