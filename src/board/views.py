import threading
import random
import json
import os

from django.db.models import Count, Q
from django.core.cache import cache
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.contrib.auth import update_session_auth_hash, login
from django.contrib.auth.decorators import login_required
from django.http import (
    HttpResponse, HttpResponseRedirect, JsonResponse, HttpResponseNotFound, Http404, QueryDict)
from django.shortcuts import render, redirect, get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.text import slugify
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt
from itertools import chain

from .models import *
from .forms import *
from . import telegram, telegram_token

# Method
def get_posts(sort='all'):
    if sort == 'top':
        return Post.objects.filter(notice=False, hide=False).annotate(like_count=Count('likes')).order_by('-like_count')
    elif sort == 'trendy':
        return Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('-trendy')
    elif sort == 'newest':
        posts = Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        threads = Thread.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False)
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)
    elif sort == 'oldest':
        return Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('created_date')
    elif sort == 'week-top':
        seven_days_ago = timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7))
        today          = timezone.make_aware(datetime.datetime.now())
        return Post.objects.filter(created_date__range=[seven_days_ago, today], notice=False, hide=False).order_by('-total')
    elif sort == 'all':
        return Post.objects.filter(hide=False).order_by('-created_date')
    elif sort == 'notice':
        posts = Post.objects.filter(notice=True).order_by('-created_date')
        threads = Thread.objects.filter(notice=True).order_by('-created_date')
        return sorted(chain(posts, threads), key=lambda instance: instance.created_date, reverse=True)

def get_clean_tag(tag):
    clean_tag = slugify(tag.replace(',', '-'), allow_unicode=True).split('-')
    return ','.join(list(set(clean_tag)))

def get_clean_all_tags(user=None):
    posts = Post.objects.filter(hide=False)
    thread = Thread.objects.filter(hide=False)
    if user == None:
        tagslist = list(posts.values_list('tag', flat=True).distinct()) + (
            list(thread.values_list('tag', flat=True).distinct()))
    else:
        tagslist = list(posts.filter(author=user).values_list('tag', flat=True).distinct()) + (
            list(thread.filter(author=user).values_list('tag', flat=True).distinct()))

    all_tags = set()
    for tags in tagslist:
        all_tags.update([x for x in tags.split(',') if not x.strip() == ''])

    all_tags_dict = list()
    for tag in all_tags:
        tag_dict = { 'name': tag }
        if user == None:
            tag_dict['count'] = len(posts.filter(tag__iregex=r'\b%s\b' % tag)) + (
                len(thread.filter(tag__iregex=r'\b%s\b' % tag)))
        else:
            tag_dict['count'] = len(posts.filter(author=user, tag__iregex=r'\b%s\b' % tag)) + (
                len(thread.filter(author=user, tag__iregex=r'\b%s\b' % tag)))
        all_tags_dict.append(tag_dict)
    return all_tags_dict

def get_user_topics(user):
    cache_key = user.username + '_topics'
    tags = cache.get(cache_key)
    if not tags:
        tags = sorted(get_clean_all_tags(user), key=lambda instance:instance['count'], reverse=True)
        cache_time = 120
        cache.set(cache_key, tags, cache_time)
    return tags

def compere_user(req, res, give_404_if='none'):
    if give_404_if == 'same':
        if req == res:
            raise Http404
    else:
        if not req == res:
            raise Http404

def page_check(page, paginator):
    try:
        page = int(page)
    except:
        raise Http404()
    if not page or int(page) > paginator.num_pages or int(page) < 1:
        raise Http404()

def add_exp(user, num):
    if hasattr(user, 'profile'):
        user.profile.exp += num
        if user.profile.exp > 100:
            user.profile.exp = 100
        user.profile.save()
    else:
        new_profile = Profile(user=user, exp=num)
        new_profile.save()

def get_exp(user):
    if hasattr(user, 'profile'):
        if user.profile.exp >= 0 and user.profile.exp < 15:
            return 'empty'
        elif user.profile.exp >= 15 and user.profile.exp < 40:
            return 'quarter'
        elif user.profile.exp >= 40 and user.profile.exp < 65:
            return 'half'
        elif user.profile.exp >= 65 and user.profile.exp < 85:
            return 'three-quarters'
        elif user.profile.exp >= 85:
            return 'full'
    else:
        return 'empty'

def get_grade(user):
    select_grade = 'blogger'
    if hasattr(user, 'profile'):
        if user.profile.grade:
            user_grade = str(user.profile.grade)
            if user_grade in grade_mapping:
                select_grade = user_grade
    return grade_mapping[select_grade]

def create_notify(user, url, infomation):
    new_notify = Notify(user=user, url=url, infomation=infomation)
    new_notify.save()
    if hasattr(user, 'config'):
        telegram_id = user.config.telegram_id
        if not telegram_id == '':
            bot = telegram.TelegramBot(telegram_token.BOT_TOKEN)
            bot.send_message_async(telegram_id, 'https://blex.kr' + url)
            bot.send_message_async(telegram_id, infomation)

# ------------------------------------------------------------ Method End



# Account
def signup(request):
    if request.user.is_active:
        return redirect('post_sort_list', sort='trendy')
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            filter_name = ['root', 'sudo', 'admin', 'administrator', 'manager', 'master', 'superuser', '관리자']
            if form.cleaned_data['username'] in filter_name:
                return render(request, 'registration/signup.html', { 'form': form, 'error': '사용할 수 없는 아이디입니다.' })
            if not form.cleaned_data['password'] == form.cleaned_data['password_check']:
                return render(request, 'registration/signup.html', { 'form': form, 'error': '입력한 비밀번호가 일치하지 않습니다.' })
            else:
                new_user = User.objects.create_user(
                    form.cleaned_data['username'],
                    form.cleaned_data['email'],
                    form.cleaned_data['password']
                )
                new_user.first_name = form.cleaned_data['first_name']
                new_user.last_name = randstr(35)
                new_user.is_active = False
                new_user.save()

                send_mail(
                    subject = '[ BLEX ] 이메일을 인증해 주세요!',
                    message = 'https://blex.kr/active/' + new_user.last_name,
                    from_email = 'im@baejino.com',
                    recipient_list = [new_user.email],
                    # html_message = render_to_string('email.html', {
                    #     'username': new_user.first_name,
                    #     'active_token': 'https://blex.kr/active/' + new_user.last_name,
                    # })
                )
                return render(request, 'infomation/signup.html', { 'user': new_user })
    else:
        form = UserForm()
    return render(request, 'registration/signup.html',{ 'form': form })

def id_check(request):
    if request.method == 'POST':
        data = {
            'name': request.POST['id']
        }
        user = User.objects.filter(username=request.POST['id'])
        if len(user) > 0:
            data['result'] = 'ERORR_OVERLAP'
        else:
            data['result'] = 'TRUE'
        return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    else:
        raise Http404()

def user_active(request, token):
    user = get_object_or_404(User, last_name=token)
    if user.date_joined < timezone.now() - datetime.timedelta(days=7):
        user.delete()
        message = '만료된 링크입니다. 다시 가입을 신청하세요.'
    else:
        user.is_active = True
        user.last_name = ''
        user.save()

        profile = Profile(user=user)
        profile.save()

        config = Config(user=user)
        config.save()

        message = '이메일이 인증되었습니다.'
    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/login\';</script>')

def signout(request):
    if request.method == 'POST':
        user = User.objects.get(username=request.user)
        user.delete()
        return render(request, 'infomation/signout.html', { 'user': user })

def opinion(request):
    if request.method == 'POST':
        req = QueryDict(request.body)
        bot = telegram.TelegramBot(telegram_token.BOT_TOKEN)
        bot.send_message_async(telegram_token.ADMIN_ID, 'Opinion : ' + req['opinion'])
        return render(request, 'infomation/thanks.html')

@login_required(login_url='/login')
def setting(request):
    render_args = { 
        'tab': '',
        'page_setting': True,
        'white_nav' : True
    }
    return render(request, 'board/setting/index.html', render_args)

@login_required(login_url='/login')
def setting_tab(request, tab):
    if not tab in [ '', 'account', 'profile', 'series', 'posts', 'thread' ]:
        raise Http404()
    else:
        user = request.user
        render_args = { 
            'tab':tab,
            'page_setting':True,
            'white_nav' : True,
        }
        if tab == 'account':
            render_args['subtitle'] = 'Account'
            if request.method == 'POST':
                if hasattr(user, 'config'):
                    config = user.config
                    c_form = ConfigForm(request.POST, instance=config)
                else:
                    c_form = ConfigForm(request.POST)
                u_form = CustomUserChangeForm(request.POST, instance=user)
                
                if u_form.is_valid():
                    update_user = u_form.save(commit=False)
                    if not u_form.cleaned_data['new_password']  == '':
                        if u_form.cleaned_data['new_password'] == u_form.cleaned_data['password_check']:
                            update_user.set_password(u_form.cleaned_data['new_password'])
                        else:
                            render_args['error'] = '비밀번호가 일치하지 않습니다.'
                    update_user.save()
                
                if c_form.is_valid():
                    config = c_form.save(commit=False)
                    config.user = user
                    config.save()
                    render_args['message'] = '성공적으로 변경되었습니다.'
            u_form = CustomUserChangeForm(instance=user)
            if hasattr(user, 'config'):
                config = user.config
                c_form = ConfigForm(instance=config)
            else:
                c_form = ConfigForm()
            render_args['u_form'] = u_form
            render_args['c_form'] = c_form
        
        elif tab == 'profile':
            render_args['subtitle'] = 'Profile'
            if request.method == 'POST':
                if hasattr(user, 'profile'):
                    profile = user.profile
                    p_form = ProfileForm(request.POST, request.FILES, instance=profile)
                else:
                    p_form = ProfileForm(request.POST, request.FILES)
                if p_form.is_valid():
                    profile = p_form.save(commit=False)
                    profile.user = user
                    profile.save()
                    render_args['message'] = '성공적으로 변경되었습니다.'
            if hasattr(user, 'profile'):
                profile = user.profile
                p_form = ProfileForm(instance=profile)
            else:
                p_form = ProfileForm()
            render_args['p_form'] = p_form
        
        elif tab == 'series':
            render_args['subtitle'] = 'Activity'
            series = Series.objects.filter(owner=user).order_by('name')
            if request.method == 'POST':
                s_form = SeriesForm(request.POST)
                if s_form.is_valid():
                    create_series = s_form.save(commit=False)
                    create_series.owner = user
                    create_series.url = slugify(create_series.name, allow_unicode=True)
                    if create_series.url == '':
                        create_series.url = randstr(15)
                    i = 1
                    while True:
                        try:
                            create_series.save()
                            break
                        except:
                            create_series.url = slugify(create_series.name+'-'+str(i), allow_unicode=True)
                            i += 1
                    render_args['message'] = '성공적으로 생성되었습니다.'
                else: render_args['error'] = '이미 존재하는 이름입니다.'
            s_form = SeriesForm()
            render_args['s_form'] = s_form
            render_args['series'] = series
        
        elif tab == 'posts':
            render_args['subtitle'] = 'Posts'
            posts = Post.objects.filter(author=user).order_by('created_date').reverse()
            
            page = request.GET.get('page', 1)
            paginator = Paginator(posts, 8)
            page_check(page, paginator)
            elements = paginator.get_page(page)
            render_args['elements'] = elements
        
        elif tab == 'thread':
            render_args['subtitle'] = 'Thread'
            threads = Thread.objects.filter(author=user).order_by('created_date').reverse()

            page = request.GET.get('page', 1)
            paginator = Paginator(threads, 8)
            page_check(page, paginator)
            elements = paginator.get_page(page)
            render_args['elements'] = elements

        return render(request, 'board/setting/index.html', render_args)
# ------------------------------------------------------------ Account End



# Profile
def user_profile(request, username):
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()
    thread = Thread.objects.filter(author=user, hide=False).order_by('created_date').reverse()
    posts_and_thread = sorted(chain(posts, thread), key=lambda instance: instance.created_date, reverse=True)

    page = request.GET.get('page', 1)
    paginator = Paginator(posts_and_thread, 6)
    page_check(page, paginator)
    elements = paginator.get_page(page)

    render_args = {
        'user': user,
        'white_nav' : True,
        'elements': elements,
        'posts_count': len(posts),
        'grade':  get_grade(user),
        'tags': get_user_topics(user),
    }
    if request.user == user:
        render_args['write_btn'] = True
    
    try:
        render_args['get_page'] = request.GET.get('page')
    except:
        pass

    return render(request, 'board/profile/index.html', render_args)

def user_profile_tab(request, username, tab):
    if not tab in ['about', 'series', 'activity']:
        raise Http404
    user = get_object_or_404(User, username=username)
    render_args = {
        'tab': tab,
        'user': user,
        'white_nav' : True,
        'grade': get_grade(user)
    }
    if request.user == user:
        render_args['write_btn'] = True
    
    if tab == 'about':
        render_args['tab_show'] = '소개'
        pass
    
    if tab == 'series':
        render_args['tab_show'] = '시리즈'
        series = Series.objects.filter(owner=user).order_by('name')
        
        page = request.GET.get('page', 1)
        paginator = Paginator(series, 10)
        page_check(page, paginator)
        elements = paginator.get_page(page)
        render_args['elements'] = elements
    if tab == 'activity':
        render_args['tab_show'] = '활동'
        posts = Post.objects.filter(author=user, hide=False)
        series = Series.objects.filter(owner=user)
        likeposts = PostLikes.objects.filter(user=user)
        comments = Comment.objects.filter(author=user, post__hide=False)
        story = Story.objects.filter(author=user, thread__hide=False)
        activity = sorted(chain(posts, series, comments, likeposts, story), key=lambda instance: instance.created_date, reverse=True)
        
        page = request.GET.get('page', 1)
        paginator = Paginator(activity, 15)
        page_check(page, paginator)
        elements = paginator.get_page(page)
        render_args['elements'] = elements

    return render(request, 'board/profile/index.html', render_args)

def user_profile_topic(request, username, tag):
    user = get_object_or_404(User, username=username)
    total_posts = len(Post.objects.filter(author=user, hide=False))
    posts = Post.objects.filter(author=user, hide=False, tag__iregex=r'\b%s\b' % tag)
    thread = Thread.objects.filter(author=user, hide=False, tag__iregex=r'\b%s\b' % tag)
    posts_and_thread = sorted(chain(posts, thread), key=lambda instance: instance.created_date, reverse=True)
    if len(posts_and_thread) == 0:
        raise Http404()
    
    page = request.GET.get('page', 1)
    paginator = Paginator(posts_and_thread, 6)
    page_check(page, paginator)
    elements = paginator.get_page(page)
    
    render_args = {
        'user': user,
        'white_nav' : True,
        'selected_tag': tag,
        'elements': elements,
        'grade': get_grade(user),
        'posts_count': total_posts,
        'tags': get_user_topics(user),
    }
    return render(request, 'board/profile/index.html', render_args)
# ------------------------------------------------------------ Profile End



# Series
def series_update(request, spk):
    series = get_object_or_404(Series, pk=spk, owner=request.user)
    if request.method == 'POST':
        form = SeriesUpdateForm(request.POST, instance=series)
        if form.is_valid():
            series = form.save(commit=False)
            series.url = slugify(series.name, allow_unicode=True)
            if series.url == '':
                series.url = randstr(15)
            i = 1
            while True:
                try:
                    series.save()
                    break
                except:
                    series.url = slugify(series.name+'-'+str(i), allow_unicode=True)
                    i += 1
            form.save_m2m()
            return HttpResponseRedirect(series.get_absolute_url())

def series_remove(request, spk):
    series = get_object_or_404(Series, pk=spk, owner=request.user)
    if request.method == 'POST':
        series.delete()
        return HttpResponse('done')

def series_list(request, username, url):
    user = get_object_or_404(User, username=username)
    series = get_object_or_404(Series, owner=user, url=url)
    render_args = {
        'user': user,
        'series': series,
        'white_nav': True,
    }

    if request.user == series.owner:
        form = SeriesUpdateForm(instance=series)
        form.fields['posts'].queryset = Post.objects.filter(author=request.user, hide=False)
        render_args['form'] = form

    return render(request, 'board/posts/series.html', render_args)
# ------------------------------------------------------------ Series End



# Others
def search(request):
    value = request.GET.get('value', '')
    render_args = {
        'white_nav' : True,
        'value' : value,
    }
    return render(request, 'board/common/search.html', render_args)

def content_backup(request):
    if not request.user.is_active:
        return redirect('index')
    user = request.user
    posts = Post.objects.filter(author=user).order_by('created_date')
    contents = []
    for post in posts:
        contents.append({
            'title': post.title,
            'image': post.image,
            'tags': post.tag,
            'date': post.created_date,
            'update': post.updated_date,
            'content': post.text_md
        })
    return render(request, 'board/posts/backup.html', {'contents':contents})

def post_list_in_tag(request, tag):
    posts = Post.objects.filter(hide=False, created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag).order_by('created_date').reverse()
    if len(posts) == 0:
        raise Http404()
    page = request.GET.get('page', 1)
    paginator = Paginator(posts, 15)
    page_check(page, paginator)
    elements = paginator.get_page(page)
    return render(request, 'board/posts/list_tag.html',{ 'tag':tag, 'elements': elements, 'white_nav':True })

@csrf_exempt
def image_upload(request):
    if request.method == 'POST':
        if request.FILES['image']:
            allowed_ext = ['jpg', 'jpeg', 'png', 'gif']
            
            image = request.FILES['image']
            ext = str(request.FILES['image']).split('.')[-1].lower()

            if not ext in allowed_ext:
                return HttpResponse('허용된 확장자가 아닙니다.')
                
            dt = datetime.datetime.now()
            upload_path = 'static/image'
            if not os.path.exists(upload_path):
                os.makedirs(upload_path)
            date_path = '/' + str(dt.year)
            if not os.path.exists(upload_path + date_path):
                os.makedirs(upload_path + date_path)
            date_path += '/' + str(dt.month) 
            if not os.path.exists(upload_path + date_path):
                os.makedirs(upload_path + date_path)
            date_path += '/' + str(dt.day)
            if not os.path.exists(upload_path + date_path):
                os.makedirs(upload_path + date_path)

            file_name = randstr(20)
            with open(upload_path + date_path + '/' + file_name +'.'+ ext, 'wb+') as destination:
                for chunk in image.chunks():
                    destination.write(chunk)
            
            if ext == 'gif':
                try:
                    os.system('ffmpeg -i '+ upload_path + date_path + '/' + file_name + '.gif' + ' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart '+ upload_path + date_path + '/' + file_name +'.mp4')
                    os.system('rm ' + upload_path + date_path + '/' + file_name + '.gif')
                    ext = 'mp4'
                except:
                    return HttpResponse('이미지 업로드를 실패했습니다.')
            return HttpResponse('https://static.blex.kr/image' + date_path + '/' + file_name +'.'+ ext)
        else:
            return HttpResponse('이미지 파일이 아닙니다.')
    else:
        raise Http404
# ------------------------------------------------------------ Others End



# Thread
def thread_create(request):
    if request.method == 'POST':
        form = ThreadForm(request.POST, request.FILES)
        if form.is_valid():
            thread = form.save(commit=False)
            thread.author = request.user
            thread.tag = get_clean_tag(thread.tag)
            thread.url = slugify(thread.title, allow_unicode=True)
            if thread.url == '':
                thread.url = randstr(15)
            i = 1
            while True:
                try:
                    thread.save()
                    break
                except:
                    thread.url = slugify(thread.title+'-'+str(i), allow_unicode=True)
                    i += 1
            add_exp(request.user, 10)
            return redirect('thread_detail', url=thread.url)

def thread_edit(request, pk):
    thread = get_object_or_404(Thread, pk=pk)
    if request.method == 'POST':
        thread_allow_write_state = thread.allow_write
        form = ThreadForm(request.POST, request.FILES, instance=thread)
        if form.is_valid():
            thread = form.save(commit=False)
            thread.tag = get_clean_tag(thread.tag)
            thread.allow_write = thread_allow_write_state
            thread.save()
            return redirect('thread_detail', url=thread.url)

def thread_detail(request, url):
    thread = get_object_or_404(Thread, url=url)
    if thread.hide == True and not thread.author == request.user:
        raise Http404()
    render_args = {
        'thread': thread,
        'white_nav': True,
        'form': StoryForm(),
        'grade': get_grade(thread.author),
    }
    stroy_all = Story.objects.filter(thread=thread)
    page = request.GET.get('page', 1)
    paginator = Paginator(stroy_all, 6)
    page_check(page, paginator)
    story_page = paginator.get_page(page)
    render_args['story_page'] = story_page

    # View Count by cookie
    if not request.user == thread.author:
        response = render(request, 'board/thread/detail.html', render_args)
        cookie_name = 'hit'
        today_end = datetime.datetime.replace(datetime.datetime.now(), hour=23, minute=59, second=0)
        expires = datetime.datetime.strftime(today_end, "%a, %d-%b-%Y %H:%M:%S GMT")
        if request.COOKIES.get(cookie_name) is not None:
            cookies = request.COOKIES.get(cookie_name)
            cookies_list = cookies.split('|')
            if 't' + str(thread.pk) not in cookies_list:
                response.set_cookie(cookie_name, cookies + '|' + 't' + str(thread.pk), expires=expires)
                thread.today += 1
                thread.save()
                return response
        else:
            response.set_cookie(cookie_name, 't' + str(thread.pk), expires=expires)
            thread.today += 1
            thread.save()
            return response
    
    return render(request, 'board/thread/detail.html', render_args)

# ------------------------------------------------------------ Thread End


# Article
def post_detail(request, username, url):
    user = get_object_or_404(User, username=username)
    post = get_object_or_404(Post, author=user, url=url)
    if post.hide == True and not post.author == request.user:
        raise Http404()

    another_posts = Post.objects.filter(author=user, hide=False).exclude(pk=post.pk).order_by('?')[:3]
    render_args = {
        'post' : post,
        'form' : CommentForm(),
        'another_posts' : another_posts,
        'check_like' : post.likes.filter(id=request.user.id).exists(),
        'current_path': request.get_full_path(),
        'battery': get_exp(user),
        'grade': get_grade(user)
    }

    # Select right series
    get_series = request.GET.get('series')
    if get_series:
        render_args['get_series'] = True
        series = Series.objects.filter(url=get_series, owner=user, posts=post.id)
    else:
        series = Series.objects.filter(owner=user, posts=post.id)

    if series:
        this_number = 0
        this_series = None
        for i in range(len(series)):
            if series[i].posts.first()== post:
                this_series = series[i]
        if not this_series:
            this_series = series[0]
        render_args['this_series'] = this_series
        for series_post in this_series.posts.all():
            if str(post.title) == str(series_post):
                break
            this_number += 1
        try:
            render_args['next_serise'] = this_series.posts.all()[this_number + 1]
        except:
            pass
        try:
            render_args['prev_serise'] = this_series.posts.all()[this_number - 1]
        except:
            pass

    # View Count by cookie
    if not request.user == post.author:
        response = render(request, 'board/posts/detail.html', render_args)
        cookie_name = 'hit'
        today_end = datetime.datetime.replace(datetime.datetime.now(), hour=23, minute=59, second=0)
        expires = datetime.datetime.strftime(today_end, "%a, %d-%b-%Y %H:%M:%S GMT")
        if request.COOKIES.get(cookie_name) is not None:
            cookies = request.COOKIES.get(cookie_name)
            cookies_list = cookies.split('|')
            if 'p' + str(post.pk) not in cookies_list:
                response.set_cookie(cookie_name, cookies + '|' + 'p' + str(post.pk), expires=expires)
                post.today += 1
                post.save()
                return response
        else:
            response.set_cookie(cookie_name, 'p' + str(post.pk), expires=expires)
            post.today += 1
            post.save()
            return response
    
    return render(request, 'board/posts/detail.html', render_args)

def index(request):
    if request.user.is_active:
        return redirect('post_sort_list', sort='trendy')
    else:
        intro_info = cache.get('intro_info')
        if not intro_info:
            cache_time = 60 * 60 * 24
            intro_info = dict()

            intro_info['user_count'] = User.objects.all().count()
            
            topics = sorted(get_clean_all_tags(), key=lambda instance:instance['count'], reverse=True)
            intro_info['top_topics'] = topics[:30]
            intro_info['topic_count'] = len(topics)

            posts = Post.objects.all()
            intro_info['posts_count'] = len(posts)

            threads = Thread.objects.all()
            intro_info['thread_count'] = len(threads)

            intro_info['page_view_count'] = 0
            for post in posts:
                intro_info['page_view_count'] += post.yesterday
            for thread in threads:
                intro_info['page_view_count'] += thread.yesterday

            cache.set('intro_info', intro_info, cache_time)

        render_args = {
            'white_nav': True,
            'intro_info': intro_info,
        }
        return render(request, 'board/index.html', render_args)

def post_sort_list(request, sort):
    available_sort = [ 'trendy', 'newest', 'oldest' ]
    if not sort in available_sort:
        raise Http404()
    posts = get_posts(sort)

    page = request.GET.get('page', 1)
    paginator = Paginator(posts, 15)
    page_check(page, paginator)
    render_args = {
        'sort' : sort,
        'elements' : paginator.get_page(page),
        'white_nav' : True
    }

    if request.user.is_active:
        render_args['write_btn'] = True

    return render(request, 'board/posts/list_sort.html', render_args)

@login_required(login_url='/login')
def post_write(request):
    if not request.user.is_active:
        raise Http404
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.text_html = parsedown(post.text_md)
            post.tag = get_clean_tag(post.tag)
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
            add_exp(request.user, 10)
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm()
    return render(request, 'board/posts/write.html', { 'form': form })

def post_edit(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not post.author == request.user:
        raise Http404
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post = form.save(commit=False)
            post.updated_date = timezone.now()
            post.text_html = parsedown(post.text_md)
            post.tag = get_clean_tag(post.tag)
            post.save()
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm(instance=post)
    return render(request, 'board/posts/write.html', {'form': form, 'post': post })
# ------------------------------------------------------------ Article End



# API V1
def notify_api_v1(request):
    if request.method == 'GET':
        if request.GET.get('id'):
            notify = get_object_or_404(Notify, pk=request.GET.get('id'))
            if notify.is_read == False:
                notify.is_read = True
                notify.save()
                return HttpResponseRedirect(notify.url)
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

def topics_api_v1(request):
    if request.method == 'GET':
        cache_key = 'main_page_topics'
        tags = cache.get(cache_key)
        if not tags:
            tags = sorted(get_clean_all_tags(), key=lambda instance:instance['count'], reverse=True)
            cache_time = 3600
            cache.set(cache_key, tags, cache_time)
        return JsonResponse({'tags': tags}, json_dumps_params = {'ensure_ascii': True})

def posts_api_v1(request, pk):
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
                add_exp(request.user, 5)

                send_notify_content = '\''+ post.title +'\' 글을 \'' + user.username + '\'님께서 추천했습니다.'
                create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)

            return HttpResponse(str(post.total_likes()))
        if put.get('hide'):
            compere_user(request.user, post.author, give_404_if='different')
            post.hide = not post.hide
            post.save()
            return JsonResponse({'hide': post.hide})
        if put.get('tag'):
            compere_user(request.user, post.author, give_404_if='different')
            post.tag = get_clean_tag(put.get('tag'))
            post.save()
            return JsonResponse({'tag': post.tag}, json_dumps_params = {'ensure_ascii': True})
    
    if request.method == 'DELETE':
        compere_user(request.user, post.author, give_404_if='different')
        post.delete()
        return HttpResponse('DONE')
    
    raise Http404

def comment_api_v1(request, pk=None):
    if not pk:
        if request.method == 'POST':
            post = get_object_or_404(Post, pk=request.GET.get('fk'))
            form = CommentForm(request.POST)
            if form.is_valid():
                comment = form.save(commit=False)
                comment.author = request.user
                comment.post = post
                comment.save()
                add_exp(request.user, 5)
                
                if not comment.author == post.author:
                    send_notify_content = '\''+ post.title +'\'에 \''+ comment.author.username +'\'님의 새로운 댓글 : ' + comment.text
                    create_notify(user=post.author, url=post.get_absolute_url(), infomation=send_notify_content)
                
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
        

def users_api_v1(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
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
            send_notify_content = '\''+ post.title +'\' 글에서 \''+ request.user.username +'\'님이 회원님을 태그했습니다.'
            create_notify(user=user, url=post.get_absolute_url(), infomation=send_notify_content)
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

def thread_api_v1(request, pk=None):
    if not pk:
        if request.method == 'GET':
            if request.GET.get('get') == 'modal':
                form = ThreadForm()
                return render(request, 'board/thread/form/thread.html', {'form': form})
    if pk:
        thread = get_object_or_404(Thread, pk=pk)
        if not request.user == thread.author:
            return HttpResponse('error:DU')
        if request.method == 'GET':
            if request.GET.get('get') == 'modal':
                form = ThreadForm(instance=thread)
                return render(request, 'board/thread/form/thread.html', {'form': form, 'thread': thread})
        if request.method == 'PUT':
            put = QueryDict(request.body)
            if put.get('bookmark'):
                if not request.user.is_active:
                    return HttpResponse('error:NL')
                if request.user == thread.author:
                    return HttpResponse('error:SU')
                user = User.objects.get(username=request.user)
                if thread.bookmark.filter(id=user.id).exists():
                    thread.bookmark.remove(user)
                    post.save()
                else:
                    thread.bookmark.add(user)
                    post.save()
                return HttpResponse(str(post.total_likes()))
            if put.get('hide'):
                compere_user(request.user, thread.author, give_404_if='different')
                thread.hide = not thread.hide
                thread.save()
                return JsonResponse({'hide': thread.hide})
            if put.get('tag'):
                compere_user(request.user, thread.author, give_404_if='different')
                thread.tag = get_clean_tag(put.get('tag'))
                thread.save()
                return JsonResponse({'tag': thread.tag}, json_dumps_params = {'ensure_ascii': True})
        if request.method == 'DELETE':
            thread.delete()
            return HttpResponse('DONE')
    raise Http404()

def story_api_v1(request, pk=None):
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
                add_exp(request.user, 5)

                data = {
                    'element': story.to_dict(),
                }

                send_notify_content = '\''+ thread.title +'\'스레드 에 \''+ story.author.username +'\'님이 새로운 스토리를 발행했습니다.'
                for user in thread.bookmark.all():
                    create_notify(user=user, url=thread.get_absolute_url(), infomation=send_notify_content)
                
                return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    if pk:
        story = get_object_or_404(Story, pk=pk)
        if not request.user == story.author:
            return HttpResponse('error:DU')
        if request.method == 'GET':
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
            if put.get('title'):
                story.title = put.get('title')
            if put.get('text_md'):
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

@csrf_exempt
def telegram_api_v1(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            bot = telegram.TelegramBot(telegram_token.BOT_TOKEN)
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
                    '오늘은 어떤게 업데이트 되었을까요?\n\nhttps://blex.kr/thread/%EA%B0%9C%EB%B0%9C%EB%85%B8%ED%8A%B8'
                ]
                bot.send_message_async(req_userid, message[random.randint(0, len(message))])
            return HttpResponse('None')
    if parameter == 'makeToken':
        if request.method == 'POST':
            if hasattr(request.user, 'config'):
                config = request.user.config
                config.telegram_token = randstr(8)
                config.save()
                return HttpResponse(request.user.config.telegram_token)
            else:
                config = Config(user=request.user)
                config.telegram_token = randstr(8)
                config.save()
                return HttpResponse(config.telegram_token)
    if parameter == 'unpair':
        if request.method == 'POST':
            config = request.user.config
            if not config.telegram_id == '':
                config.telegram_id = ''
                config.save()
                return HttpResponse('DONE')
            else:
                return HttpResponse('error:AU')
# ------------------------------------------------------------ API V1 End