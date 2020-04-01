import random
import json

from itertools import chain
from django.db.models import Count, Q
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import render, get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt

from .models import *
from .forms import *
from .telegram import TelegramBot
from . import telegram_token
from . import views_fn as fn

def topics(request):
    if request.method == 'GET':
        cache_key = 'main_page_topics'
        tags = cache.get(cache_key)
        if not tags:
            tags = sorted(fn.get_clean_all_tags(), key=lambda instance:instance['count'], reverse=True)
            cache_time = 3600
            cache.set(cache_key, tags, cache_time)
        return JsonResponse({'tags': tags}, json_dumps_params = {'ensure_ascii': True})

    raise Http404

def posts(request, pk):
    post = get_object_or_404(Post, pk=pk)

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
                if post.trendy > 10 :
                    post.trendy -= 10
                else :
                    post.trendy = 0
                post.save()
            else:
                post.likes.add(user)
                post.trendy += 10
                post.save()
                fn.add_exp(request.user, 5)

                send_notify_content = '\''+ post.title +'\' 글을 \'' + user.username + '\'님께서 추천했습니다.'
                fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)

            return HttpResponse(str(post.total_likes()))
        if put.get('hide'):
            fn.compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            if post.hide == True:
                for series in post.series.all():
                    series.posts.remove(post)
                    series.save()
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
                comment.author = request.user
                comment.post = post
                comment.save()
                fn.add_exp(request.user, 5)
                
                if not comment.author == post.author:
                    send_notify_content = '\''+ post.title +'\'에 \''+ comment.author.username +'\'님의 새로운 댓글 : ' + comment.text
                    fn.create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
                
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
                return HttpResponse(str(comment.total_likes()))
            if put.get('text'):
                if not request.user == comment.author:
                    return HttpResponse('error:DU')
                comment.text = put.get('text')
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
            form.fields['posts'].queryset = Post.objects.filter(created_date__lte=timezone.now(), author=request.user, hide=False)
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
        if not request.user.is_active:
            return HttpResponse('error:NL')
        if not request.user == user:
            return HttpResponse('error:DU')
        
        if request.GET.get('get') == 'notify':
            if request.GET.get('id'):
                notify = get_object_or_404(Notify, pk=request.GET.get('id'))
                if notify.is_read == False:
                    notify.is_read = True
                    notify.save()
                    return HttpResponse(notify.url)
                else:
                    raise Http404
            else:
                if request.user.is_active:
                    notify = Notify.objects.filter(user=request.user, is_read=False).order_by('created_date').reverse()
                    data = {
                        'count': len(notify),
                        'content': list()
                    }
                    if data['count'] > 0:
                        for notify_one in notify:
                            data['content'].append(notify_one.to_dict())
                    return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
                return HttpResponse(str(-1))
        
        if request.GET.get('get') == 'posts_analytics':
            if request.GET.get('pk'):
                pk = request.GET.get('pk')
                seven_days_ago  = timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7))
                today           = timezone.make_aware(datetime.datetime.now())
                posts_analytics = PostAnalytics.objects.filter(posts__id=pk, date__range=[seven_days_ago, today]).order_by('-date')

                data = {
                    'items': [],
                    'referers': [],
                }
                for item in posts_analytics:
                    data['items'].append({
                        'date': item.date,
                        'count': item.count
                    })
                    for refer in item.referer.split('|'):
                        if '^' in refer:
                            data['referers'].append({
                                'time': refer.split('^')[0],
                                'from': refer.split('^')[1],
                            })

                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
            else:
                posts = Post.objects.filter(author=request.user).order_by('created_date').reverse()
                return JsonResponse({'posts': [post.to_dict_for_analytics() for post in posts]}, json_dumps_params = {'ensure_ascii': True})
        
        if request.GET.get('get') == 'thread_analytics':
            if request.GET.get('pk'):
                pk = request.GET.get('pk')
                seven_days_ago   = timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7))
                today            = timezone.make_aware(datetime.datetime.now())
                thread_analytics = ThreadAnalytics.objects.filter(thread__id=pk, date__range=[seven_days_ago, today]).order_by('-date')

                data = {
                    'items': [],
                    'referers': [],
                }
                for item in thread_analytics:
                    data['items'].append({
                        'date': item.date,
                        'count': item.count
                    })
                    for refer in item.referer.split('|'):
                        if '^' in refer:
                            data['referers'].append({
                                'time': refer.split('^')[0],
                                'from': refer.split('^')[1],
                            })

                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
            else:
                threads = Thread.objects.filter(author=request.user).order_by('created_date').reverse()
                return JsonResponse({'thread': [thread.to_dict_for_analytics() for thread in threads]}, json_dumps_params = {'ensure_ascii': True})
        
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
        
        if put.get('tagging'):
            post_pk = request.GET.get('on')
            post = get_object_or_404(Post, pk=post_pk)
            send_notify_content = '\"'+ post.title +'\" 글에서 @'+ request.user.username +'님이 회원님을 태그했습니다.'
            fn.create_notify(user=user, url=post.get_absolute_url(), infomation=send_notify_content)
            return HttpResponse(str(0))
        
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

def thread(request, pk=None):
    if not pk:
        if request.method == 'GET':
            if request.GET.get('get') == 'modal':
                form = ThreadForm()
                return render(request, 'board/thread/form/thread.html', {'form': form})
    if pk:
        thread = get_object_or_404(Thread, pk=pk)
        if request.method == 'GET':
            if not request.user == thread.author:
                return HttpResponse('error:DU')
            if request.GET.get('get') == 'modal':
                form = ThreadForm(instance=thread)
                return render(request, 'board/thread/form/thread.html', {'form': form, 'thread': thread})
        if request.method == 'PUT':
            put = QueryDict(request.body)
            if put.get('bookmark'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if not thread.allow_write and request.user == thread.author:
                    return HttpResponse('error:SU')
                user = User.objects.get(username=request.user)
                if thread.bookmark.filter(id=user.id).exists():
                    thread.bookmark.remove(user)
                    thread.save()
                else:
                    thread.bookmark.add(user)
                    thread.save()
                return HttpResponse('DONE')
            if put.get('hide'):
                fn.compere_user(request.user, thread.author, give_404_if='different')
                thread.hide = not thread.hide
                thread.save()
                return JsonResponse({'hide': thread.hide})
            if put.get('tag'):
                fn.compere_user(request.user, thread.author, give_404_if='different')
                thread.tag = fn.get_clean_tag(put.get('tag'))
                thread.save()
                return JsonResponse({'tag': thread.tag}, json_dumps_params = {'ensure_ascii': True})
        if request.method == 'DELETE':
            thread.delete()
            return HttpResponse('DONE')
    
    raise Http404

def story(request, pk=None):
    if not pk:
        if request.method == 'POST':
            thread = get_object_or_404(Thread, pk=request.GET.get('fk'))
            form = StoryForm(request.POST)
            if form.is_valid():
                story = form.save(commit=False)
                story.text_html = parsedown(story.text_md)
                story.author = request.user
                story.thread = thread
                story.save()
                thread.created_date = story.created_date
                thread.save()
                fn.add_exp(request.user, 5)

                data = {
                    'element': story.to_dict(),
                }

                send_notify_content = '\"'+ thread.title +'\"스레드 에 @'+ story.author.username +'님이 새로운 스토리를 발행했습니다.'
                for user in thread.bookmark.all():
                    if not user == story.author:
                        fn.create_notify(user=user, url=thread.get_absolute_url(), infomation=send_notify_content)
                
                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    if pk:
        story = get_object_or_404(Story, pk=pk)
        if request.method == 'GET':
            if not request.user == story.author:
                return HttpResponse('error:DU')
            if request.GET.get('get') == 'form':
                form = StoryForm(instance=story)
                return render(request, 'board/thread/form/story.html', {'form': form, 'story': story})
            else:
                data = {
                    'state': 'true',
                    'element': story.to_dict()
                }
                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
        if request.method == 'PUT':
            put = QueryDict(request.body)
            if put.get('agree'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if request.user == story.author:
                    return HttpResponse('error:SU')
                user = User.objects.get(username=request.user)
                if story.agree.filter(id=user.id).exists():
                    story.agree.remove(user)
                    story.save()
                else:
                    if story.disagree.filter(id=user.id).exists():
                        return HttpResponse('error:AD')
                    story.agree.add(user)
                    story.save()
                return HttpResponse(str(story.total_agree()))
            if put.get('disagree'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if request.user == story.author:
                    return HttpResponse('error:SU')
                user = User.objects.get(username=request.user)
                if story.disagree.filter(id=user.id).exists():
                    story.disagree.remove(user)
                    story.save()
                else:
                    if story.agree.filter(id=user.id).exists():
                        return HttpResponse('error:AA')
                    story.disagree.add(user)
                    story.save()
                return HttpResponse(str(story.total_disagree()))
            if put.get('title'):
                if not request.user == story.author:
                    return HttpResponse('error:DU')
                story.title = put.get('title')
            if put.get('text_md'):
                if not request.user == story.author:
                    return HttpResponse('error:DU')
                story.text_md = put.get('text_md')
                story.text_html = parsedown(story.text_md)
            story.updated_date = timezone.now()
            story.save()
                
            data = {
                'state': 'true',
                'element': story.to_dict()
            }

            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
        if request.method == 'DELETE':
            story.delete()
            return HttpResponse('DONE')
    
    raise Http404

@csrf_exempt
def telegram(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            bot = TelegramBot(telegram_token.BOT_TOKEN)
            req = json.loads(request.body.decode("utf-8"))
            req_token = req['message']['text']
            req_userid = req['message']['from']['id']
            check = None
            try:
                check = Config.objects.get(telegram_token=req_token)
            except:
                pass
            if check:
                check.telegram_token = ''
                check.telegram_id = req_userid
                check.save()
                bot.send_message_async(req_userid, '정상적으로 연동되었습니다.')
            else:
                message = [
                    '안녕하세요? BLEX_BOT 입니다!',
                    'BLEX — BLOG EXPRESS ME!',
                    '회원님의 알림을 이곳으로 보내드릴게요!',
                    '오늘은 어떤게 업데이트 되었을까요?\n\nhttps://blex.me/thread/%EA%B0%9C%EB%B0%9C%EB%85%B8%ED%8A%B8'
                ]
                bot.send_message_async(req_userid, message[random.randint(0, len(message))])
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