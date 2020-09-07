import re
import json
import time
import random

from itertools import chain
from django.db.models import Count, Q
from django.core.cache import cache
from django.core.paginator import Paginator
from django.contrib import auth
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import render, get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from board.models import *
from board.forms import *
from board.telegram import TelegramBot
from board.views import function as fn

@csrf_exempt
def login(request):
    if request.method == 'POST':
        username = request.POST.get('username', '')
        password = request.POST.get('password', '')
        
        user = auth.authenticate(username=username, password=password)

        if user is not None:
            if user.is_active:
                auth.login(request, user)
                return JsonResponse({
                    'login': 'success'
                }, json_dumps_params={'ensure_ascii': True})
        else:
            result = {
                'login': 'failure'
            }
            return JsonResponse(result, json_dumps_params={'ensure_ascii': True})

def signup(request):
    pass

def topics(request):
    if request.method == 'GET':
        cache_key = 'main_page_topics'
        tags = cache.get(cache_key)
        if not tags:
            tags = sorted(fn.get_clean_all_tags(), key=lambda instance:instance['count'], reverse=True)
            cache_time = 3600
            cache.set(cache_key, tags, cache_time)
        return JsonResponse({'tags': tags}, json_dumps_params={'ensure_ascii': True})

    raise Http404

def posts(request, sort):
    if request.method == 'GET':
        posts = fn.get_posts(sort)
        page = request.GET.get('page', 1)
        paginator = Paginator(posts, 21)
        fn.page_check(page, paginator)
        posts = paginator.get_page(page)
        return JsonResponse({
            'items': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': post.get_thumbnail(),
                'read_time': post.read_time(),
                'created_date': post.created_date,
                'author_image': post.author.profile.get_thumbnail(),
                'author': post.author.username,
            }, posts)),
            'last_page': posts.paginator.num_pages
        }, json_dumps_params={'ensure_ascii': True})
    

def post(request, url):
    post = get_object_or_404(Post, url=url)

    if request.method == 'GET':
        comments = Comment.objects.filter(post=post).order_by('created_date')
        return JsonResponse({
            'id': post.id,
            'title': post.title,
            'image': post.get_thumbnail(),
            'description': post.description(),
            'read_time': post.read_time(),
            'created_date': post.created_date.strftime('%Y-%m-%d %H:%M'),
            'updated_date': post.updated_date.strftime('%Y-%m-%d %H:%M'),
            'author_image': post.author.profile.get_thumbnail(),
            'author': post.author.username,
            'text_html': post.text_html,
            'total_likes': post.total_likes(),
            'comments': list(map(lambda comment: {
                'author_image': comment.author.profile.get_thumbnail(),
                'author': comment.author.username,
                'text_html': comment.text_html,
            }, comments))
        })

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('like'):
            if not request.user.is_active:
                return HttpResponse('error:NL')
            if request.user == post.author:
                return HttpResponse('error:SU')
            user = User.objects.get(username=request.user)
            if post.likes.filter(id=user.id).exists():
                post.likes.remove(user)
            else:
                post.likes.add(user)
                fn.add_exp(request.user, 1)

                send_notify_content = '\''+ post.title +'\'글을 누군가 추천했습니다.'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)

            return HttpResponse(str(post.total_likes()))
        if put.get('hide'):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            post.save()
            return JsonResponse({'hide': post.hide})
        if put.get('tag'):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.tag = fn.get_clean_tag(put.get('tag'))
            post.save()
            return JsonResponse({'tag': post.tag}, json_dumps_params = {'ensure_ascii': True})
    
    if request.method == 'DELETE':
        fn.compere_user(request.user, post.author, give_404_if='different')
        post.delete()
        return HttpResponse('DONE')
    
    raise Http404

def temp_posts(request):
    if request.method == 'GET':
        token = request.GET.get('token')
        if token:
            temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
            return JsonResponse(temp_posts.to_dict(), json_dumps_params = {'ensure_ascii': True})

        if request.GET.get('get') == 'list':
            temps = TempPosts.objects.filter(author=request.user)
            data = {
                'result': list()
            }
            for temp in temps:
                data['result'].append({
                    'token': temp.token,
                    'title': temp.title,
                    'date': timesince(temp.created_date)
                })
            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})

    if request.method == 'POST':
        temps = TempPosts.objects.filter(author=request.user).count()
        if temps >= 5:
            return HttpResponse('Error:EG')
        
        body = QueryDict(request.body)

        token = randstr(25)
        has_token = TempPosts.objects.filter(token=token, author=request.user)
        while len(has_token) > 0:
            token = randstr(35)
            has_token = TempPosts.objects.filter(token=token, author=request.user)
        
        temp_posts = TempPosts(token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()

        return HttpResponse(token)
    
    if request.method == 'PUT':
        body = QueryDict(request.body)
        token = body.get('token')
        temp_posts = get_object_or_404(TempPosts, token=token, author=request.user)
        temp_posts.title = body.get('title')
        temp_posts.text_md = body.get('text_md')
        temp_posts.tag = body.get('tag')
        temp_posts.save()

        return HttpResponse('DONE')
    
    raise Http404

def comment(request, pk=None):
    if not pk:
        if request.method == 'POST':
            post = get_object_or_404(Post, pk=request.GET.get('fk'))
            form = CommentForm(request.POST)
            if form.is_valid():
                comment = form.save(commit=False)
                comment.text_html = parsedown(comment.text_md)
                comment.author = request.user
                comment.post = post
                comment.save()
                fn.add_exp(request.user, 1)
                
                if not comment.author == post.author:
                    send_notify_content = '\''+ post.title +'\'글에 @'+ comment.author.username +'님이 댓글을 남겼습니다.'
                    fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
                
                regex = re.compile(r'\`\@([a-zA-Z0-9]*)\`\s?')
                if regex.search(comment.text_md):
                    tag_user_list = regex.findall(comment.text_md)
                    tag_user_list = set(tag_user_list)

                    commentors = Comment.objects.filter(post=post).values_list('author__username')
                    commentors = set(map(lambda instance: instance[0], commentors))

                    for tag_user in tag_user_list:
                        if tag_user in commentors:
                            _user = User.objects.get(username=tag_user)
                            if not _user == request.user:
                                send_notify_content = '\''+ post.title +'\'글에서 @'+ request.user.username +'님이 회원님을 태그했습니다.'
                                fn.create_notify(user=_user, url=post.get_absolute_url(), infomation=send_notify_content)
                
                data = {
                    'state': 'true',
                    'element': comment.to_dict()
                }
                data['element']['edited'] = ''
                
                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    
    if pk:
        comment = get_object_or_404(Comment, pk=pk)
        if request.method == 'GET':
            if request.GET.get('get') == 'form':
                if not request.user == comment.author:
                    return HttpResponse('error:DU')
                form = CommentForm(instance=comment)
                return render(request, 'board/posts/form/comment.html', {'form': form, 'comment': comment})
            else:
                data = {
                    'state': 'true',
                    'element': comment.to_dict()
                }
                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
        
        if request.method == 'PUT':
            put = QueryDict(request.body)
            if put.get('like'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if request.user == comment.author:
                    return HttpResponse('error:SU')
                user = User.objects.get(username=request.user)
                if comment.likes.filter(id=user.id).exists():
                    comment.likes.remove(user)
                    comment.save()
                else:
                    comment.likes.add(user)
                    comment.save()
                    send_notify_content = '\''+ comment.post.title +'\'글에 작성한 회원님의 댓글을 누군가 추천했습니다.'
                    fn.create_notify(user=comment.author, url=comment.post.get_absolute_url(), infomation=send_notify_content)
                return HttpResponse(str(comment.total_likes()))
            if put.get('text_md'):
                if not request.user == comment.author:
                    return HttpResponse('error:DU')
                comment.text_md = put.get('text_md')
                comment.text_html = parsedown(comment.text_md)
                comment.edit = True
                comment.save()
                
                data = {
                    'state': 'true',
                    'element': comment.to_dict()
                }

                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
        
        if request.method == 'DELETE':
            if not request.user == comment.author:
                return HttpResponse('error:DU')
            data = {
                'pk': comment.pk
            }
            comment.delete()
            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    
    raise Http404

def series(request, pk):
    series = get_object_or_404(Series, pk=pk)

    if request.method == 'GET':
        if request.GET.get('get') == 'modal':
            if not request.user == series.owner:
                return HttpResponse('error:DU')
            form = SeriesUpdateForm(instance=series)
            return render(request, 'board/series/form/series.html', {'form': form, 'series': series})
        
    if request.method == 'DELETE':
        if not request.user == series.owner:
            return HttpResponse('error:DU')
        series.delete()
        return HttpResponse('DONE')
    
    raise Http404

def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        if request.GET.get('get') == 'activity':
            standard_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=365)))
            
            posts = Post.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, hide=False)
            series = Series.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), owner=user)
            comments = Comment.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, post__hide=False)
            activity = chain(posts, series, comments)

            data = dict()
            for element in activity:
                key = timestamp(element.created_date, kind='grass')[:10]
                if key in data:
                    data[key] += 1
                else:
                    data[key] = 1
            return JsonResponse({'data': data}, json_dumps_params = {'ensure_ascii': True})

        if not request.user.is_active:
            return HttpResponse('error:NL')
        if not request.user == user:
            return HttpResponse('error:DU')
            
        if request.GET.get('get') == 'posts_analytics':
            if request.GET.get('pk'):
                pk = request.GET.get('pk')
                seven_days_ago  = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7)))
                posts_analytics = PostAnalytics.objects.filter(posts__id=pk, created_date__gt=seven_days_ago).order_by('-created_date')
                posts_referers = Referer.objects.filter(posts__posts__id=pk, created_date__gt=seven_days_ago).order_by('-created_date')[:30]

                data = {
                    'items': [],
                    'referers': [],
                }
                for item in posts_analytics:
                    data['items'].append({
                        'date': item.created_date,
                        'count': item.table.count()
                    })
                for referer in posts_referers:
                    data['referers'].append({
                        'time': convert_to_localtime(referer.created_date).strftime('%Y-%m-%d %H:%M'),
                        'from': referer.referer_from.location,
                    })

                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
            else:
                posts = Post.objects.filter(author=request.user).order_by('created_date').reverse()
                return JsonResponse({'posts': [post.to_dict_for_analytics() for post in posts]}, json_dumps_params = {'ensure_ascii': True})
        
        if request.GET.get('get') == 'about-form':
            if hasattr(user, 'profile'):
                form = AboutForm(instance=user.profile)
                return render(request, 'board/profile/form/about.html', {'form': form})
            else:
                form = AboutForm()
                return render(request, 'board/profile/form/about.html', {'form': form})

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('follow'):
            if not request.user.is_active:
                return HttpResponse('error:NL')
            if request.user == user:
                return HttpResponse('error:SU')
            
            follower = User.objects.get(username=request.user)
            if hasattr(user, 'profile'):
                if user.profile.subscriber.filter(id = follower.id).exists():
                    user.profile.subscriber.remove(follower)
                else:
                    user.profile.subscriber.add(follower)
            else:
                profile = Profile(user=user)
                profile.save()
                profile.subscriber.add(follower)
            return HttpResponse(str(user.profile.total_subscriber()))
        
        if put.get('about'):
            if not request.user == user:
                return HttpResponse('error:DU')
            about_md = put.get('about_md')
            about_html = parsedown(about_md)
            if hasattr(user, 'profile'):
                user.profile.about_md = about_md
                user.profile.about_html = about_html
                user.profile.save()
            else:
                profile = Profile(user=user)
                profile.about_md = about_md
                profile.about_html = about_html
                profile.save()
            
            return HttpResponse(about_html)
    
    raise Http404

@csrf_exempt
def telegram(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            print(request.body.decode("utf-8"))
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            try:
                req = json.loads(request.body.decode("utf-8"))
                req_userid = req['message']['from']['id']
                req_token = req['message']['text']
                check = Config.objects.get(telegram_token=req_token)
                if check:
                    check.telegram_token = ''
                    check.telegram_id = req_userid
                    check.save()
                    bot.send_message_async(req_userid, '정상적으로 연동되었습니다.')
            except:
                message = '블렉스 다양한 정보를 살펴보세요!\n\n' + settings.SITE_URL + '/notion'
                bot.send_message_async(req_userid, message)
            return HttpResponse('None')
    if parameter == 'makeToken':
        if request.method == 'POST':

            token = randstr(6)
            has_token = Config.objects.filter(telegram_token=token)
            while len(has_token) > 0:
                token = randstr(6)
                has_token = Config.objects.filter(telegram_token=token)

            if hasattr(request.user, 'config'):
                config = request.user.config
                config.telegram_token = token
                config.save()
                return HttpResponse(token)
            else:
                config = Config(user=request.user)
                config.telegram_token = token
                config.save()
                return HttpResponse(token)
    if parameter == 'unpair':
        if request.method == 'POST':
            config = request.user.config
            if not config.telegram_id == '':
                config.telegram_id = ''
                config.save()
                return HttpResponse('DONE')
            else:
                return HttpResponse('error:AU')
    
    raise Http404