from django.http import HttpResponse, HttpResponseRedirect, JsonResponse, HttpResponseNotFound, Http404
from django.contrib.auth import update_session_auth_hash, login
from django.contrib.auth.decorators import login_required
from django.template.loader import render_to_string
from django.template.defaultfilters import linebreaks
from django.shortcuts import render, redirect, get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.core.serializers.json import DjangoJSONEncoder
from django.core.paginator import Paginator
from django.core.mail import EmailMessage
from django.db.models import Count, Q
from django.utils.html import strip_tags
from django.utils.html import escape
from django.utils.text import slugify
from django.utils import timezone
from django.utils.timesince import timesince
from itertools import chain
from .models import *
from .forms import *
import threading, json, os

# Method
def get_posts(sort):
    if sort == 'top':
        return Post.objects.filter(notice=False, hide=False).annotate(like_count=Count('likes')).order_by('-like_count')
    elif sort == 'trendy':
        return Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('trendy').reverse()
    elif sort == 'newest':
        return Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('created_date').reverse()
    elif sort == 'oldest':
        return Post.objects.filter(created_date__lte=timezone.now(), notice=False, hide=False).order_by('created_date')
    elif sort == 'week-top':
        now_date = datetime.datetime.now().strftime("%Y-%m-%d")
        seven_days_ago = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime("%Y-%m-%d")
        return Post.objects.filter(created_date__range=[seven_days_ago, now_date], notice=False, hide=False).order_by('view_cnt').reverse()
    elif sort == 'all':
        return Post.objects.filter(hide=False).order_by('created_date').reverse()
    else:
        return Post.objects.filter(notice=True).order_by('created_date')

def get_clean_all_tags(user):
    posts = Post.objects.filter()
    if user == None:
        tagslist = list(posts.filter(hide=False).values_list('tag', flat=True).distinct())
    else:
        tagslist = list(posts.filter(hide=False, author=user).values_list('tag', flat=True).distinct())
        
    all_tags = []
    for anothertags in tagslist:
        for subtag in anothertags.split(','):
            if not subtag.strip() == '':
                all_tags.append(subtag.strip())
    all_tags = list(set(all_tags))

    all_tags_dict = list()
    for tag in all_tags:
        tag_dict = { 'name': tag }
        if user == None:
            tag_dict['count'] = len(posts.filter(created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag))
        else:
            tag_dict['count'] = len(posts.filter(author=user, created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag))
        all_tags_dict.append(tag_dict)
    return all_tags_dict

def send_mail(title, mail_args, mail_list):
    html_message = render_to_string('mail_template.html', mail_args)
    email = EmailMessage('[ BLEX ] '+ title, html_message, to=mail_list)
    email.content_subtype = 'html'
    return email.send()

def compere_user(req, res, same='none'):
    if same == 'same?':
        if req == res:
            raise Http404
    else:
        if not req == res:
            raise Http404

def get_comment_json_element(user, comment):
    element = {
        'pk': comment.pk,
        'author': comment.author.username,
        'created_date': timesince(comment.created_date),
        'content': linebreaks(escape(comment.text)),
    }

    if hasattr(user, 'profile'):
        element['thumbnail'] = user.profile.avatar.url
    else:
        element['thumbnail'] = 'https://static.blex.kr/assets/images/default-avatar.jpg'

    return element

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

# ------------------------------------------------------------ Method End



# Account
def signup(request):
    if request.user.is_active:
        message = '이미 로그인 된 사용자입니다.'
        return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/\';</script>')
    if request.method == 'POST':
        form = UserForm(request.POST)
        if form.is_valid():
            filter_name = ['root', 'sudo', 'admin', 'administrator', 'manager', 'master', 'superuser', '관리자']
            if form.cleaned_data['username'] in filter_name:
                return render(request, 'registration/signup.html',{'form':form, 'error':'사용할 수 없는 아이디입니다.'})
            if form.cleaned_data['password']  == form.cleaned_data['password_check']:
                new_user = User.objects.create_user(form.cleaned_data['username'],form.cleaned_data['email'],form.cleaned_data['password'])
                new_user.first_name = form.cleaned_data['first_name']
                new_user.last_name = randstr(35)
                new_user.is_active = False
                new_user.save()
                mail_args = {
                    'active_mail': True,
                    'to':new_user.first_name, 
                    'link': 'https://blex.kr/active/' + new_user.last_name
                }
                t = threading.Thread(target=send_mail, args=('이메일을 인증해 주세요', mail_args, [form.cleaned_data['email']]))
                t.start()
                message = new_user.first_name + '님께서 입력하신 메일로 인증 링크를 발송했습니다.'
                return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/login\';</script>')
            else:
                return render(request, 'registration/signup.html',{'form':form, 'error':'입력한 비밀번호가 일치하지 않습니다.'})
    else:
        form = UserForm()
    return render(request, 'registration/signup.html',{'form':form })

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
        message = '이메일이 인증되었습니다.'
    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/login\';</script>')

def signout(request):
    user = User.objects.get(username=request.user)
    user.delete()
    message = '정상적으로 탈퇴되었습니다. 그동안 이용해 주셔서 감사합니다.'
    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/\';</script>')

@login_required(login_url='/login')
def setting(request):
    if not request.user.is_active:
        return redirect('post_list')
    else:
        user = request.user
        tab = request.GET.get('tab', '')
        if not tab in [ '', 'account', 'profile', 'series', 'analysis' ]:
            raise Http404()
        render_args = { 'tab':tab, 'page_setting':True, 'white_nav' : True, }
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
        
        elif tab == 'analysis':
            render_args['subtitle'] = 'Analysis'
            posts = Post.objects.filter(author=user).order_by('created_date').reverse()
            render_args['posts'] = posts

        return render(request, 'board/setting.html', render_args)
# ------------------------------------------------------------ Account End



# Profile
def user_profile(request, username):
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()

    paginator = Paginator(posts, 6)
    page = request.GET.get('page')
    elements = paginator.get_page(page)

    render_args = {
        'user': user,
        'white_nav' : True,
        'elements': elements,
        'posts_count': len(posts),
        'tags': sorted(get_clean_all_tags(user), key=lambda instance:instance['count'], reverse=True)
    }
    return render(request, 'board/user_profile.html', render_args)

def user_follow(request, username):
    following = get_object_or_404(User, username=username)
    compere_user(request.user, following, 'same?')
    if request.method == 'POST':
        follower = User.objects.get(username=request.user)
        if hasattr(following, 'profile'):
            if following.profile.subscriber.filter(id = follower.id).exists():
                following.profile.subscriber.remove(follower)
            else:
                following.profile.subscriber.add(follower)
        else:
            profile = Profile(user=following)
            profile.save()
            profile.subscriber.add(follower)
        
        return HttpResponse(str(following.profile.total_subscriber()))
    return redirect('post_list')

def user_profile_tab(request, username, tab):
    if not tab in [ 'series', 'activity' ]:
        return post_detail(request, username, tab)
    
    user = get_object_or_404(User, username=username)
    render_args = {
        'tab': tab,
        'user': user,
        'white_nav' : True,
    }

    if tab == 'series':
        series = Series.objects.filter(owner=user).order_by('name')
        paginator = Paginator(series, 10)
        page = request.GET.get('page')
        elements = paginator.get_page(page)
    if tab == 'activity':
        posts = Post.objects.filter(author=user, hide=False)
        series = Series.objects.filter(owner=user)
        likeposts = PostLikes.objects.filter(user=user)
        comments = Comment.objects.filter(author=user, post__hide=False)
        activity = sorted(chain(posts, series, comments, likeposts), key=lambda instance: instance.created_date, reverse=True)
        
        paginator = Paginator(activity, 15)
        page = request.GET.get('page')
        elements = paginator.get_page(page)
    
    render_args['elements'] = elements

    return render(request, 'board/user_profile.html', render_args)

def user_profile_topic(request, username, tag):
    user = get_object_or_404(User, username=username)
    total_posts = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()
    posts = total_posts.filter(tag__iregex=r'\b%s\b' % tag)
    if len(posts) == 0:
        raise Http404()
    
    paginator = Paginator(posts, 6)
    page = request.GET.get('page')
    elements = paginator.get_page(page)
    
    render_args = {
        'user': user,
        'white_nav' : True,
        'selected_tag': tag,
        'elements': elements,
        'posts_count': len(total_posts),
        'tags': sorted(get_clean_all_tags(user), key=lambda instance:instance['count'], reverse=True)
    }
    return render(request, 'board/user_profile.html', render_args)
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
        'series': series
    }

    if request.user == series.owner:
        form = SeriesUpdateForm(instance=series)
        form.fields['posts'].queryset = Post.objects.filter(author=request.user, hide=False)
        render_args['form'] = form

    select_theme = 'Default'
    if hasattr(user, 'config'):
        if user.config.post_theme:
            user_theme = str(user.config.post_theme)
            if user_theme in theme_mapping:
                select_theme = user_theme
    render_args['theme'] = theme_mapping[select_theme]

    return render(request, 'board/series.html', render_args)
# ------------------------------------------------------------ Series End


# Notify
def user_notify(request):
    if request.method == 'GET':
        if request.GET.get('redirect'):
            notify = get_object_or_404(Notify, pk=request.GET.get('redirect'))
            if notify.is_read == False:
                notify.is_read = True
                notify.save()
                return HttpResponseRedirect(notify.post.get_absolute_url())
            else:
                raise Http404
        else:
            notify = Notify.objects.filter(user=request.user, is_read=False).order_by('created_date').reverse()
            data = {
                'count': len(notify),
                'content': list()
            }
            if data['count'] > 0:
                for notify_one in notify:
                    data['content'].append({
                        'pk': notify_one.pk,
                        'infomation': notify_one.infomation,
                        'created_date': timesince(notify_one.created_date)
                    })
            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})

def notify_user_tagging(request, touser, fromuser):
    if request.method == 'POST':
        if request.user.username == fromuser:
            if not touser == fromuser:
                post_pk = request.GET.get('blex')
                senduser = get_object_or_404(User, username=touser)
                post = get_object_or_404(Post, pk=post_pk)

                send_notify_content = '\''+ post.title +'\' 글에서 \''+ fromuser +'\'님이 회원님을 태그했습니다.'
                create_notify(user=senduser, post=post, infomation=send_notify_content)
                
                return HttpResponse(str(0))
    return redirect('post_list')
# ------------------------------------------------------------ Notify End



# Comment
def comment_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.author = request.user
            comment.post = post
            comment.save()
            add_exp(request.user, 5)
            
            if not comment.author == post.author:
                send_notify_content = '\''+ post.title +'\'에 \''+ comment.author.username +'\'님의 새로운 댓글 : ' + comment.text
                create_notify(user=post.author, post=post, infomation=send_notify_content)
            
            data = {
                'state': 'true',
                'element': get_comment_json_element(request.user, comment)
            }
            data['element']['edited'] = ''
            
            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    else:
        raise Http404()

def get_commentor(request, pk):
    post = get_object_or_404(Post, pk=pk)
    comments = Comment.objects.filter(post=post).order_by('created_date').reverse()
    m_list  = []
    for comment in comments:
        m_list.append(comment.author.username)
    m_list = list(set(m_list))
    result = ''
    for commentor in m_list:
        result += commentor + ','
    return HttpResponse(result)

def comment_update(request, cpk):
    comment = Comment.objects.get(pk=cpk)
    compere_user(request.user, comment.author)

    if request.method == 'POST':
        form = CommentForm(request.POST, instance=comment)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.edit = True
            comment.save()
            
            data = {
                'state': 'true',
                'element': get_comment_json_element(request.user, comment)
            }
            data['element']['edited'] = 'edited'

            return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
        else:
            return HttpResponse('fail')

    form = CommentForm(instance=comment)
    return render(request, 'board/small/comment_update.html', {'form': form, 'comment': comment})

def comment_rest(request, cpk):
    comment = Comment.objects.get(pk=cpk)
    compere_user(request.user, comment.author)

    if request.method == 'GET':
        data = {
            'state': 'true',
            'element': get_comment_json_element(request.user, comment)
        }
        data['element']['edited'] = 'edited'

        return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})
    
    if request.method == 'DELETE':
        data = {
            'pk': comment.pk
        }
        comment.delete()
        return JsonResponse(data, json_dumps_params = {'ensure_ascii': True})

    raise Http404
# ------------------------------------------------------------ Comment End



# Others
def search(request):
    value = request.GET.get('value', '')
    render_args = {
        'white_nav' : True,
        'value' : value,
    }
    if not value == '':
        posts = get_posts('all')
        posts = posts.filter(Q(title__icontains=value) | Q(author__username=value))
        paginator = Paginator(posts, 15)
        page = request.GET.get('page')
        pageposts = paginator.get_page(page)
        render_args['posts'] = pageposts
    return render(request, 'board/search.html', render_args)

def content_backup(request):
    if not request.user.is_active:
        return redirect('post_list')
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
    return render(request, 'board/content_backup.html', {'contents':contents})

def post_list_in_tag(request, tag):
    posts = Post.objects.filter(hide=False, created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag).order_by('created_date').reverse()
    if len(posts) == 0:
        raise Http404()
    paginator = Paginator(posts, 15)
    page = request.GET.get('page')
    pageposts = paginator.get_page(page)
    return render(request, 'board/post_list_in_tag.html',{ 'tag':tag, 'pageposts':pageposts, 'white_nav':True })

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
            return HttpResponse('https://static.blex.kr/image/' + date_path + '/' + file_name +'.'+ ext)
        else:
            return HttpResponse('이미지 파일이 아닙니다.')
    else:
        raise Http404
# ------------------------------------------------------------ Others End



# Article
def post_detail(request, username, url):
    user = get_object_or_404(User, username=username)
    post = get_object_or_404(Post, author=user, url=url)
    if post.hide == True and not post.author == request.user:
        return HttpResponse(str('<script>alert(\'비공개 글입니다.\');history.back();</script>'))

    another_posts = Post.objects.filter(author=user, hide=False).exclude(pk=post.pk).order_by('?')[:3]
    render_args = {
        'post' : post,
        'form' : CommentForm(),
        'another_posts' : another_posts,
        'check_like' : post.likes.filter(id=request.user.id).exists(),
        'current_path': request.get_full_path(),
        'battery': get_exp(user),
        'post_usernav_action': True,
    }

    # Fonts & Theme
    select_font = 'Noto Sans'
    select_theme = 'Default'
    if hasattr(post.author, 'config'):
        if post.author.config.post_fonts:
            user_font = str(post.author.config.post_fonts)
            if user_font in font_mapping:
                select_font = user_font
        if post.author.config.post_theme:
            user_theme = str(post.author.config.post_theme)
            if user_theme in theme_mapping:
                select_theme = user_theme
    render_args['fonts'] = font_mapping[select_font]
    render_args['theme'] = theme_mapping[select_theme]

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
    response = render(request, 'board/post_detail.html', render_args)
    cookie_name = 'hit'
    today_end = datetime.datetime.replace(datetime.datetime.now(), hour=23, minute=59, second=0)
    expires = datetime.datetime.strftime(today_end, "%a, %d-%b-%Y %H:%M:%S GMT")
    if request.COOKIES.get(cookie_name) is not None:
        cookies = request.COOKIES.get(cookie_name)
        cookies_list = cookies.split('|')
        if str(post.pk) not in cookies_list:
            response.set_cookie(cookie_name, cookies + '|' + str(post.pk), expires =expires)
            post.view_cnt += 1
            post.save()
            return response
    else:
        response.set_cookie(cookie_name, post.pk, expires =expires)
        post.view_cnt += 1
        post.save()
        return response
    
    return render(request, 'board/post_detail.html', render_args)

def post_list(request):
    render_args = {
        'white_nav': True,
        'pageposts': get_posts(''),
        'weekly_top' : get_posts('trendy')[:4],
        'tags': sorted(get_clean_all_tags(None), key=lambda instance:instance['count'], reverse=True)
    }

    if request.user.is_active:
        render_args['write_btn'] = True

    return render(request, 'board/post_list.html', render_args)

def post_sort_list(request, sort):
    available_sort = [ 'trendy', 'newest', 'oldest' ]
    if not sort in available_sort:
        raise Http404()
    
    posts = get_posts(sort)
    paginator = Paginator(posts, 15)
    page = request.GET.get('page')
    
    render_args = {
        'sort' : sort,
        'pageposts' : paginator.get_page(page),
        'white_nav' : True
    }

    if request.user.is_active:
        render_args['write_btn'] = True

    return render(request, 'board/post_sort_list.html', render_args)

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
            post.tag = slugify(post.tag.replace(',', '-'), allow_unicode=True).replace('-', ',')
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
    return render(request, 'board/post_write.html',{ 'form':form })

def post_like(request, pk):
    post = get_object_or_404(Post, pk=pk)
    compere_user(request.user, post.author, 'same?')
    if request.method == 'POST':
        user = User.objects.get(username=request.user)
        if post.likes.filter(id = user.id).exists():
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
            create_notify(user=post.author, post=post, infomation=send_notify_content)

        return HttpResponse(str(post.total_likes()))
    return redirect('post_list')

def post_hide(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not post.author == request.user:
        raise Http404
    if request.method == 'POST':
        post.hide = not post.hide
        post.save()
        return JsonResponse({'hide': post.hide})
    raise Http404

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
            post.tag = slugify(post.tag.replace(',', '-'), allow_unicode=True).replace('-', ',')
            post.save()
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm(instance=post)
    return render(request, 'board/post_write.html', {'form': form, 'post': post })

def post_remove(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not post.author == request.user:
        return redirect('post_detail', username=post.author, url=post.url)
    else:
        post.delete()
        return redirect('post_list')
# ------------------------------------------------------------ Article End