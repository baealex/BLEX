import json
import os
import re

from PIL import Image, ImageFilter
from itertools import chain
from django.db.models import Count, Q
from django.core.cache import cache
from django.core.mail import send_mail
from django.core.files import File
from django.core.paginator import Paginator
from django.core.serializers.json import DjangoJSONEncoder
from django.contrib import auth
from django.contrib.auth.decorators import login_required
from django.http import (
    HttpResponse, HttpResponseRedirect, JsonResponse, HttpResponseNotFound, Http404, QueryDict)
from django.shortcuts import render, redirect, get_object_or_404
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify
from django.utils.timesince import timesince
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings

from .models import *
from .forms import *
from . import telegram
from . import views_fn as fn

# Account
def social_login(request, social):
    if request.user.is_active:
        auth.logout(request)
    
    if social == 'github':
        if request.GET.get('code'):
            state = fn.auth_github(request.GET.get('code'))
            if state['status']:
                node_id = state['user'].get('node_id')
                try:
                    user = User.objects.get(last_name='github:' + str(node_id))
                    if user.is_active:
                        auth.login(request, user)
                        return redirect(settings.LOGIN_REDIRECT_URL)
                    else:
                        return render(request, 'registration/username.html', {'token': 'github:' + str(node_id)})
                except:
                    pass
                    
                username = randstr(10)
                has_name = User.objects.filter(username=username)
                while len(has_name) > 0:
                    has_name = User.objects.filter(username=username)
                    username = randstr(10)
                
                new_user = User(username=username)
                new_user.first_name = state['user'].get('name')
                new_user.last_name = 'github:' + str(node_id)
                new_user.email = state['user'].get('email')
                new_user.is_active = False
                new_user.save()

                profile = Profile(user=new_user)
                avatar = fn.get_image(state['user'].get('avatar_url'))
                if avatar:
                    profile.avatar.save(name='png', content=File(avatar))
                profile.github = state['user'].get('login')
                profile.save()

                config = Config(user=new_user)
                config.save()

                auth.login(request, new_user)
                return render(request, 'registration/username.html', {'token': 'github:' + str(node_id)})
            else:
                return render(request, 'registration/login.html', {'error': '요청중 에러가 발생했습니다.'})
    
    if social == 'google':
        if request.GET.get('code'):
            state = fn.auth_google(request.GET.get('code'))
            if state['status']:
                node_id = state['user'].get('id')
                try:
                    user = User.objects.get(last_name='google:' + str(node_id))
                    if user.is_active:
                        auth.login(request, user)
                        return redirect(settings.LOGIN_REDIRECT_URL)
                    else:
                        return render(request, 'registration/username.html', {'token': 'google:' + str(node_id)})
                except:
                    pass
                
                username = randstr(10)
                has_name = User.objects.filter(username=username)
                while len(has_name) > 0:
                    has_name = User.objects.filter(username=username)
                    username = randstr(10)
                
                new_user = User(username=username)
                new_user.first_name = state['user'].get('name')
                new_user.last_name = 'google:' + str(node_id)
                new_user.email = state['user'].get('email')
                new_user.is_active = False
                new_user.save()

                profile = Profile(user=new_user)
                avatar = fn.get_image(state['user'].get('picture'))
                if avatar:
                    profile.avatar.save(name='png', content=File(avatar))
                profile.save()

                config = Config(user=new_user)
                config.save()
                return render(request, 'registration/username.html', {'token': 'google:' + str(node_id)})
            else:
                return render(request, 'registration/login.html', {'error': '요청중 에러가 발생했습니다.'})
    
    raise Http404

def login(request):
    if request.user.is_active:
        auth.logout(request)
    
    if request.method == 'POST':
        if fn.auth_captcha(request.POST.get('g-recaptcha')):
            username = request.POST.get('username', '')
            password = request.POST.get('password', '')

            user = auth.authenticate(username=username, password=password)

            if user is not None:
                if user.is_active:
                    auth.login(request, user)
                    if request.GET.get('next'):
                        return redirect(request.GET.get('next'))
                    return redirect(settings.LOGIN_REDIRECT_URL)
            return render(request, 'registration/login.html', {'error': '아이디와 패스워드가 틀립니다.'})
        else:
            return render(request, 'registration/login.html', {'error': '사용자 검증에 실패했습니다.'})
    return render(request, 'registration/login.html')

def set_username(request):
    if request.method == 'POST':
        if fn.auth_captcha(request.POST.get('g-recaptcha')):
            token = request.POST.get('token', '')
            username = request.POST.get('username', '')

            if not token:
                return redirect('login')

            filter_name = ['root', 'sudo', 'admin', 'administrator', 'manager', 'master', 'superuser']
            if not username or username in filter_name:
                return render(request, 'registration/username.html', {'token': token, 'error': '사용할 수 없는 아이디입니다.'})
            
            regex = re.compile('[a-z0-9]*')
            if not len(regex.match(username).group()) == len(username):
                return render(request, 'registration/username.html', {'token': token, 'error': '사용할 수 없는 아이디입니다.'})

            user = get_object_or_404(User, last_name=token)
            user.username = username
            user.is_active = True
            user.save()

            auth.login(request, user)
            return redirect(settings.LOGIN_REDIRECT_URL)
        else:
            return render(request, 'registration/username.html', {'token': token, 'error': '사용자 검증에 실패했습니다.'})
    
    raise Http404

def signup(request):
    if request.user.is_active:
        return redirect('post_sort_list', sort='trendy')
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']

            filter_name = ['root', 'sudo', 'admin', 'administrator', 'manager', 'master', 'superuser']
            if username in filter_name:
                return render(request, 'registration/signup.html', {'form': form, 'error': '사용할 수 없는 아이디입니다.' })
            
            regex = re.compile('[a-z0-9]*')
            if not len(regex.match(username).group()) == len(username):
                 return render(request, 'registration/signup.html', {'form': form, 'error': '사용할 수 없는 아이디입니다.' })
            
            if not form.cleaned_data['password'] == form.cleaned_data['password_check']:
                return render(request, 'registration/signup.html', {'form': form, 'error': '비밀번호가 일치하지 않습니다.' })
            
            token = randstr(35)
            has_token = User.objects.filter(last_name=token)
            while len(has_token) > 0:
                token = randstr(35)
                has_token = User.objects.filter(last_name=token)

            new_user = User.objects.create_user(
                form.cleaned_data['username'],
                form.cleaned_data['email'],
                form.cleaned_data['password']
            )
            new_user.first_name = form.cleaned_data['first_name']
            new_user.last_name = 'email:' + token
            new_user.is_active = False
            new_user.save()

            if not settings.DEBUG:
                send_mail(
                    subject = '[ BLEX ] 이메일을 인증해 주세요!',
                    message = settings.SITE_URL + '/active/' + token,
                    from_email = 'im@baejino.com',
                    recipient_list = [new_user.email],
                    # html_message = render_to_string('email.html', {
                    #     'username': new_user.first_name,
                    #     'active_token': settings.SITE_URL + '/active/' + token,
                    # })
                )
            return render(request, 'infomation/signup.html', { 'user': new_user })
    else:
        form = UserForm()
    return render(request, 'registration/signup.html',{ 'form': form })

def id_check(request):
    if request.method == 'POST':
        username = request.POST['id']
        user = User.objects.filter(username=username)
        if len(user) > 0:
            return HttpResponse('ERROR:OL')
        else:
            regex = re.compile('[a-z0-9]*')
            if not len(regex.match(username).group()) == len(username):
                return HttpResponse('ERROR:NM')
            return HttpResponse('DONE')

    raise Http404

def user_active(request, token):
    user = get_object_or_404(User, last_name='email:' + token)
    if user.date_joined < timezone.now() - datetime.timedelta(days=7):
        user.delete()
        message = '만료된 링크입니다. 다시 가입하세요.'
    else:
        user.is_active = True
        user.last_name = ''
        user.save()

        profile = Profile(user=user)
        profile.save()

        config = Config(user=user)
        config.save()

        message = '이메일이 인증되었습니다.'

        fn.create_notify(user=user, url='/@baealex/series/블렉스-이야기', infomation=user.first_name + (
            '님의 가입을 진심으로 환영합니다! 블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 \'블렉스 이야기\'시리즈를 살펴보시는 것을 추천드립니다 :)'))

    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/login\';</script>')

@login_required(login_url='/login')
def signout(request):
    if request.method == 'POST':
        user = User.objects.get(username=request.user)
        user.delete()
        auth.logout(request)
        return render(request, 'infomation/signout.html', { 'user': user })
    raise Http404

def opinion(request):
    if request.method == 'POST':
        req = QueryDict(request.body)
        bot = telegram.TelegramBot(settings.TELEGRAM_BOT_TOKEN)
        bot.send_message_async(settings.TELEGRAM_ADMIN_ID, 'Opinion : ' + req['opinion'])
        return render(request, 'infomation/thanks.html')
    raise Http404

@login_required(login_url='/login')
def notify_redirect(request, pk):
    notify = get_object_or_404(Notify, pk=pk)
    if not notify.is_read:
        notify.is_read = True
        notify.save()
        return redirect(notify.url)
    else:
        return redirect('setting')

@login_required(login_url='/login')
def setting(request):
    render_args = { 
        'tab': '',
        'white_nav' : True,
        'page_setting': True,
    }
    notifies = Notify.objects.filter(user=request.user).order_by('created_date').reverse()

    page = request.GET.get('page', 1)
    paginator = Paginator(notifies, 15)
    fn.page_check(page, paginator)
    elements = paginator.get_page(page)
    render_args['elements'] = elements

    counter = 0
    for notify in notifies:
        if not notify.is_read:
            counter += 1
    render_args['not_read_count'] = counter
    return render(request, 'board/setting/index.html', render_args)

@login_required(login_url='/login')
def setting_tab(request, tab):
    if not tab in [ '', 'account', 'profile', 'series', 'posts', 'thread' ]:
        raise Http404()
    else:
        user = request.user
        render_args = {
            'tab': tab,
            'white_nav': True,
            'page_setting': True,
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
            render_args['subtitle'] = 'Series'
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
        
        elif tab == 'thread':
            render_args['subtitle'] = 'Thread'
            threads = Thread.objects.filter(author=user).order_by('created_date').reverse()

            page = request.GET.get('page', 1)
            paginator = Paginator(threads, 8)
            fn.page_check(page, paginator)
            elements = paginator.get_page(page)
            render_args['elements'] = elements

        return render(request, 'board/setting/index.html', render_args)
# ------------------------------------------------------------ Account End



# Profile
def user_profile(request, username):
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(created_date__lte=timezone.now(), author=user, hide=False).order_by('created_date').reverse()
    thread = Thread.objects.filter(created_date__lte=timezone.now(), author=user, hide=False).order_by('created_date').reverse()
    posts_and_thread = sorted(chain(posts, thread), key=lambda instance: instance.created_date, reverse=True)

    page = request.GET.get('page', 1)
    paginator = Paginator(posts_and_thread, 10)
    fn.page_check(page, paginator)
    elements = paginator.get_page(page)

    render_args = {
        'user': user,
        'elements': elements,
        'posts_count': len(posts),
        'grade':  fn.get_grade(user),
        'tags': fn.get_user_topics(user),
        'battery': fn.get_exp(user),
    }
    if request.user == user:
        render_args['write_btn'] = True
    
    try:
        render_args['get_page'] = request.GET.get('page')
    except:
        pass

    render_args.update(fn.night_mode(request))
    return render(request, 'board/profile/index.html', render_args)

def user_profile_tab(request, username, tab):
    if not tab in ['about', 'series', 'activity']:
        raise Http404
    user = get_object_or_404(User, username=username)
    render_args = {
        'tab': tab,
        'user': user,
        'grade': fn.get_grade(user),
        'battery': fn.get_exp(user),
    }
    if request.user == user:
        render_args['write_btn'] = True
    
    if tab == 'about':
        render_args['tab_show'] = '소개'
        pass
    
    if tab == 'series':
        render_args['tab_show'] = '시리즈'
        series = Series.objects.annotate(count_posts=Count('posts')).filter(owner=user, count_posts__gt=0).order_by('name')
        
        page = request.GET.get('page', 1)
        paginator = Paginator(series, 10)
        fn.page_check(page, paginator)
        elements = paginator.get_page(page)
        render_args['elements'] = elements

    if tab == 'activity':
        render_args['tab_show'] = '활동'
        posts = Post.objects.filter(created_date__lte=timezone.now(), author=user, hide=False)
        series = Series.objects.filter(owner=user)
        likeposts = PostLikes.objects.filter(user=user)
        comments = Comment.objects.filter(author=user, post__hide=False)
        story = Story.objects.filter(author=user, thread__hide=False)
        activity = sorted(chain(posts, series, comments, likeposts, story), key=lambda instance: instance.created_date, reverse=True)
        
        page = request.GET.get('page', 1)
        paginator = Paginator(activity, 15)
        fn.page_check(page, paginator)
        elements = paginator.get_page(page)
        render_args['elements'] = elements

    render_args.update(fn.night_mode(request))
    return render(request, 'board/profile/index.html', render_args)

def user_profile_topic(request, username, tag):
    user = get_object_or_404(User, username=username)
    total_posts = len(Post.objects.filter(created_date__lte=timezone.now(), author=user, hide=False))
    posts = Post.objects.filter(created_date__lte=timezone.now(), author=user, hide=False, tag__iregex=r'\b%s\b' % tag)
    thread = Thread.objects.filter(created_date__lte=timezone.now(), author=user, hide=False, tag__iregex=r'\b%s\b' % tag)
    posts_and_thread = sorted(chain(posts, thread), key=lambda instance: instance.created_date, reverse=True)
    if len(posts_and_thread) == 0:
        raise Http404()
    
    page = request.GET.get('page', 1)
    paginator = Paginator(posts_and_thread, 6)
    fn.page_check(page, paginator)
    elements = paginator.get_page(page)
    
    render_args = {
        'user': user,
        'selected_tag': tag,
        'elements': elements,
        'battery': fn.get_exp(user),
        'grade': fn.get_grade(user),
        'posts_count': total_posts,
        'tags': fn.get_user_topics(user),
    }
    render_args.update(fn.night_mode(request))
    return render(request, 'board/profile/index.html', render_args)
# ------------------------------------------------------------ Profile End



# Series
def series_update(request, spk):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        series = get_object_or_404(Series, pk=spk, owner=request.user)
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

def series_list(request, username, url):
    user = get_object_or_404(User, username=username)
    series = get_object_or_404(Series, owner=user, url=url)
    render_args = {
        'user': user,
        'series': series,
    }
    render_args.update(fn.night_mode(request))
    return render(request, 'board/series/list.html', render_args)
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
        raise Http404
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

@csrf_exempt
def image_upload(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        if request.FILES['image']:
            allowed_ext = ['jpg', 'jpeg', 'png', 'gif']
            
            image = request.FILES['image']
            ext = str(request.FILES['image']).split('.')[-1].lower()

            if not ext in allowed_ext:
                return HttpResponse('허용된 확장자가 아닙니다.')
                
            dt = datetime.datetime.now()
            upload_path = fn.make_path(
                'static/images/content',
                [
                    str(dt.year),
                    str(dt.month),
                    str(dt.day),
                    str(request.user.username)
                ]
            )

            file_name = str(dt.hour) + '_' + randstr(20)
            with open(upload_path + '/' + file_name + '.' + ext, 'wb+') as destination:
                for chunk in image.chunks():
                    destination.write(chunk)
            
            if ext == 'gif':
                try:
                    image_path = upload_path + '/' + file_name
                    convert_image = Image.open(image_path + '.' + ext).convert('RGB')
                    preview_image = convert_image.filter(ImageFilter.GaussianBlur(50))
                    preview_image.save(image_path + '.mp4.preview.jpg', quality=50)

                    os.system('ffmpeg -i '+ upload_path + '/' + file_name + '.gif' + ' -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -movflags +faststart '+ upload_path + '/' + file_name +'.mp4')
                    os.system('rm ' + upload_path + '/' + file_name + '.gif')
                    ext = 'mp4'
                except:
                    return HttpResponse('이미지 업로드를 실패했습니다.')
            else:
                try:
                    image_path = upload_path + '/' + file_name + '.' + ext
                    resize_image = Image.open(image_path)
                    resize_image.thumbnail((1920, 1920), Image.ANTIALIAS)
                    resize_image.save(image_path)

                    if not ext == 'jpg':
                        resize_image = resize_image.convert('RGB')
                    preview_image = resize_image.filter(ImageFilter.GaussianBlur(50))
                    preview_image.save(image_path + '.preview.jpg', quality=50)
                except:
                    return HttpResponse('이미지 업로드를 실패했습니다.')
            return HttpResponse(settings.MEDIA_URL + upload_path.replace('static/', '') + '/' + file_name + '.' + ext)
        else:
            return HttpResponse('이미지 파일이 아닙니다.')
    raise Http404
# ------------------------------------------------------------ Others End



# Thread
def thread_create(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        form = ThreadForm(request.POST, request.FILES)
        if form.is_valid():
            thread = form.save(commit=False)
            thread.author = request.user
            thread.tag = fn.get_clean_tag(thread.tag)
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
            fn.add_exp(request.user, 2)
            return redirect('thread_detail', url=thread.url)
    raise Http404

def thread_edit(request, pk):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404
        thread = get_object_or_404(Thread, pk=pk)
        thread_allow_write_state = thread.allow_write
        form = ThreadForm(request.POST, request.FILES, instance=thread)
        if form.is_valid():
            thread = form.save(commit=False)
            thread.tag = fn.get_clean_tag(thread.tag)
            thread.allow_write = thread_allow_write_state
            thread.save()
            return redirect('thread_detail', url=thread.url)
    raise Http404

def thread_detail(request, url):
    thread = get_object_or_404(Thread, url=url)
    if thread.hide == True and not thread.author == request.user:
        raise Http404()
    render_args = {
        'thread': thread,
        'form': StoryForm(),
        'grade': fn.get_grade(thread.author),
        'check_bookmark': thread.bookmark.filter(id=request.user.id).exists(),
    }
    
    render_args.update(fn.night_mode(request))
    return render(request, 'board/thread/detail.html', render_args)

def story_detail(request, url, username, timestamp):
    thread = get_object_or_404(Thread, url=url)
    if thread.hide == True and not thread.author == request.user:
        raise Http404()
    
    render_args = {
        'thread': thread,
        'form': StoryForm(),
        'grade': fn.get_grade(thread.author),
        'check_bookmark': thread.bookmark.filter(id=request.user.id).exists(),
    }
    render_args['story_detail'] = True

    # View Count by iptable
    if not request.user == thread.author:
        today = timezone.make_aware(datetime.datetime.now())
        thread_today = None
        try:
            thread_today = ThreadAnalytics.objects.get(date=today, thread=thread)
        except:
            thread_today = ThreadAnalytics(thread=thread)
        
        user_ip = fn.get_encrypt_ip(request)
        if not user_ip in thread_today.iptable:
            thread_today.count += 1
            thread_today.iptable += user_ip + '|'
        
            if 'Referer' in request.headers:
                now = datetime.datetime.now().strftime('%H:%M')
                thread_today.referer += now + '^' + request.headers['Referer'] + '|'

        thread_today.save()

    user = get_object_or_404(User, username=username)
    date = timezone.make_aware(datetime.datetime.fromtimestamp(float(timestamp)/1000000))
    story = get_object_or_404(Story, author=user, created_date=date)
    render_args['story'] = story

    render_args.update(fn.night_mode(request))
    return render(request, 'board/thread/detail.html', render_args)

# ------------------------------------------------------------ Thread End

# Article
def post_detail(request, username, url):
    user = get_object_or_404(User, username=username)
    post = get_object_or_404(Post, author=user, url=url)
    if post.hide == True and not post.author == request.user:
        raise Http404()

    render_args = {
        'post' : post,
        'form' : CommentForm(),
        'check_like' : post.likes.filter(id=request.user.id).exists(),
        'current_path': request.get_full_path(),
        'battery': fn.get_exp(user),
        'grade': fn.get_grade(user)
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
            if series[i].posts.first() == post:
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

    # View Count by iptable
    if not request.user == post.author:
        today = timezone.make_aware(datetime.datetime.now())
        post_today = None
        try:
            post_today = PostAnalytics.objects.get(date=today, posts=post)
        except:
            post_today = PostAnalytics(posts=post)
        
        user_ip = fn.get_encrypt_ip(request)
        if not user_ip in post_today.iptable:
            post_today.count += 1
            post_today.iptable += user_ip + '|'
        
            if 'Referer' in request.headers:
                now = datetime.datetime.now().strftime('%H:%M')
                post_today.referer += now + '^' + request.headers['Referer'] + '|'
        
        post_today.save()
    
    render_args.update(fn.night_mode(request))
    render_args['white_nav'] = False
    render_args['never_chage'] = True
    return render(request, 'board/posts/detail.html', render_args)

def post_sort_list(request, sort=None):
    render_args = dict()
    
    if request.user.is_active:
        render_args['write_btn'] = True
    
    if sort == 'tags':
        tags = cache.get('tags')
        if not tags:
            cache_time = 60 * 60 * 24
            tags = sorted(fn.get_clean_all_tags(), key=lambda instance:instance['count'], reverse=True)
            cache.set('tags', tags, cache_time)
        page = request.GET.get('page', 1)
        paginator = Paginator(tags, 120)
        fn.page_check(page, paginator)
        render_args['elements'] = paginator.get_page(page)

    else:
        if not sort:
            sort = 'trendy'
        available_sort = ['trendy', 'newest']
        if not sort in available_sort:
            raise Http404
        posts = fn.get_posts(sort)

        page = request.GET.get('page', 1)
        paginator = Paginator(posts, 21)
        fn.page_check(page, paginator)
        render_args['elements'] = paginator.get_page(page)

    render_args['sort'] = sort
    render_args.update(fn.night_mode(request))
    return render(request, 'board/lists/sort.html', render_args)

def post_list_in_tag(request, tag):
    posts = Post.objects.filter(created_date__lte=timezone.now(), hide=False, tag__iregex=r'\b%s\b' % tag).order_by('created_date').reverse()
    thread = Thread.objects.filter(created_date__lte=timezone.now(), hide=False, tag__iregex=r'\b%s\b' % tag).order_by('created_date').reverse()
    elements = sorted(chain(posts, thread), key=lambda instance: instance.created_date, reverse=True)
    if len(elements) == 0:
        raise Http404()
    page = request.GET.get('page', 1)
    paginator = Paginator(elements, 21)
    fn.page_check(page, paginator)
    elements = paginator.get_page(page)

    render_args = {
        'tag': tag,
        'elements': elements,
    }
    render_args.update(fn.night_mode(request))
    return render(request, 'board/lists/topic.html', render_args)

def post_write(request):
    if not request.user.is_active:
        raise Http404
    
    get_token = request.GET.get('token')
    if get_token:
        try:
            TempPosts.objects.get(token=get_token, author=request.user)
        except:
            raise Http404
    
    if request.method == 'POST':        
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.text_html = parsedown(post.text_md)
            post.tag = fn.get_clean_tag(post.tag)
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
            fn.add_exp(request.user, 2)

            get_token = request.GET.get('token')
            if get_token:
                try:
                    TempPosts.objects.get(token=get_token, author=request.user).delete()
                except:
                    pass
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm()
    return render(request, 'board/posts/write.html', { 'form': form, 'save': True })

def post_edit(request, timestamp):
    if not request.user.is_active:
        raise Http404
    
    date = timezone.make_aware(datetime.datetime.fromtimestamp(float(timestamp)/1000000))
    post = get_object_or_404(Post, author=request.user, created_date=date)
    if not post.author == request.user:
        raise Http404
    
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post = form.save(commit=False)
            post.updated_date = timezone.now()
            post.text_html = parsedown(post.text_md)
            post.tag = fn.get_clean_tag(post.tag)
            if post.hide == True:
                for series in post.series.all():
                    series.posts.remove(post)
                    series.save()
            post.save()
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm(instance=post)
    return render(request, 'board/posts/write.html', {'form': form, 'post': post })
# ------------------------------------------------------------ Article End