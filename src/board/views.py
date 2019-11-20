from django.http import HttpResponse, HttpResponseRedirect, JsonResponse, HttpResponseNotFound, Http404
from django.contrib.auth import update_session_auth_hash, login
from django.template.loader import render_to_string
from django.shortcuts import render, get_object_or_404
from django.shortcuts import render, redirect
from django.core.serializers.json import DjangoJSONEncoder
from django.core.paginator import Paginator
from django.core.mail import EmailMessage
from django.db.models import Count, Q
from django.utils.html import strip_tags
from django.utils.text import slugify
from django.utils import timezone
from .models import *
from .forms import *
import threading, json

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
        now_date = datetime.datetime.now()
        now_date_str = str(now_date.year) + '-' + str(now_date.month) + '-' + str(now_date.day)
        seven_days_ago = datetime.datetime.now() - datetime.timedelta(days=7)
        seven_days_ago_str = str(seven_days_ago.year) + '-' + str(seven_days_ago.month) + '-' + str(seven_days_ago.day)
        return Post.objects.filter(created_date__range=[seven_days_ago_str, now_date_str], notice=False, hide=False).order_by('view_cnt').reverse()
    elif sort == 'all':
        return Post.objects.filter(hide=False).order_by('created_date').reverse()
    else:
        return Post.objects.filter(notice=True).order_by('created_date')

def get_clean_all_tags():
    tagslist = list(Post.objects.values_list('tag', flat=True).distinct())
    tags = []
    for anothertags in tagslist:
        for subtag in anothertags.split(','):
            if not subtag.strip() == '':
                tags.append(subtag.strip())
    tags = list(set(tags))
    return tags

def send_mail(title, mail_args, mail_list):
    html_message = render_to_string('mail_template.html', mail_args)
    email = EmailMessage('[ BLEX ] '+ title, html_message, to=mail_list)
    email.content_subtype = 'html'
    return email.send()
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

        send_notify_rederct_url = '/@baealex/%EC%84%9C%EB%B9%84%EC%8A%A4-%EC%9D%B4%EC%9A%A9%EC%95%BD%EA%B4%80'
        send_notify_content = 'BLEX의 회원이 되신 것을 진심으로 환영합니다.'
        create_notify(target=user, url=send_notify_rederct_url, content=send_notify_content)
    
    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/login\';</script>')

def signout(request):
    user = User.objects.get(username=request.user)
    user.delete()
    message = '정상적으로 탈퇴되었습니다. 그동안 이용해 주셔서 감사합니다.'
    return HttpResponse('<script>alert(\'' + message + '\');location.href = \'/\';</script>')

def setting(request):
    if not request.user.is_active:
        return redirect('post_list')
    else:
        user = request.user
        tab = request.GET.get('tab', '')
        available_tab = [ '', 'account', 'profile', 'activity', 'analysis' ]
        if not tab in available_tab:
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
        
        elif tab == 'activity':
            render_args['subtitle'] = 'Activity'
            series = Series.objects.filter(owner=user).order_by('name')
            if request.method == 'POST':
                s_form = SeriesForm(request.POST)
                if s_form.is_valid():
                    create_series = s_form.save(commit=False)
                    create_series.owner = user
                    create_series.save()
                    render_args['message'] = '성공적으로 생성되었습니다.'
                else: render_args['error'] = '이미 존재하는 이름입니다.'
            s_form = SeriesForm()
            render_args['s_form'] = s_form
            render_args['series'] = series

            subpost = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()
            hidepost = Post.objects.filter(author=user, hide=True).order_by('created_date').reverse()
            render_args['subpost'] = subpost
            render_args['hidepost'] = hidepost
        
        elif tab == 'analysis':
            render_args['subtitle'] = 'Analysis'
            posts = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()
            render_args['posts'] = posts

        return render(request, 'board/setting.html', render_args)
# ------------------------------------------------------------ Account End



# Profile
def user_profile(request, username):
    user = get_object_or_404(User, username=username)
    posts = Post.objects.filter(author=user, hide=False).order_by('created_date').reverse()
    series = Series.objects.filter(owner=user).order_by('name')
    comments = Comment.objects.filter(author=user).order_by('created_date').reverse()
    likeposts = Post.objects.filter(likes=user).reverse()
    render_args = {
        'user': user,
        'posts': posts,
        'series': series,
        'likeposts': likeposts,
        'comments': comments,
        'white_nav' : True,
    }
    return render(request, 'board/user_profile.html', render_args)
# ------------------------------------------------------------ Profile End



# Series
def series_update(request, spk):
    series = get_object_or_404(Series, pk=spk, owner=request.user)
    if request.method == 'POST':
        form = SeriesPostForm(request.POST, instance=series)
        if form.is_valid():
            series = form.save(commit=False)
            series.save()
            form.save_m2m()
            return HttpResponse('<script>self.close();opener.location.href = opener.location.href;</script>')
    else:
        form = SeriesPostForm(instance=series)
        form.fields['posts'].queryset = Post.objects.filter(author=request.user, hide=False)
        return render(request, 'board/small/series_update.html',{ 'form':form, 'spk':spk })

def series_remove(request, spk):
    series = get_object_or_404(Series, pk=spk, owner=request.user)
    series.delete()
    return HttpResponse('<script>self.close();opener.location.href = opener.location.href;</script>')

def series_list(request, username, name):
    user = get_object_or_404(User, username=username)
    series = get_object_or_404(Series, owner=user, name=name)
    render_args = {
        'user': user,
        'series': series
    }
    return render(request, 'board/series.html', render_args)
# ------------------------------------------------------------ Series End


# Notify
def notify_read(request):
    notify_num = request.GET.get('redirect')
    notify = Notify.objects.get(pk=notify_num)
    if not notify.to_user == request.user:
        return HttpResponse(str('<script>alert(\'잘못된 접근입니다.\');history.back();</script>'))
    redirect_url = notify.from_user
    notify.delete()
    return HttpResponseRedirect(redirect_url)

def notify_count(request):
    notify = Notify.objects.filter(to_user=request.user)
    notify_num = len(notify)
    return HttpResponse(str(notify_num))

def notify_content(request):
    notify = Notify.objects.filter(to_user=request.user).order_by('created_date').reverse()
    result_data = ''
    for notify_one in notify:
        data = { 'pk': notify_one.pk, 'infomation': notify_one.infomation, 'created_date': notify_one.created_date }
        result_data += render_to_string('board/part_render/notify_toast.html', data)
    return HttpResponse(result_data)
    data = list(notify)
    return JsonResponse(data)

def notify_user_tagging(request, touser, fromuser):
    if request.method == 'POST':
        if request.user.username == fromuser:
            if not touser == fromuser:
                post_pk = request.GET.get('blex')
                senduser = get_object_or_404(User, username=touser)
                post = get_object_or_404(Post, pk=post_pk)

                send_notify_rederct_url = '/@'+post.author.username+'/'+post.url
                send_notify_content = '\''+ post.title +'\' 글에서 \''+ fromuser +'\'님이 당신을 태그했습니다.'
                create_notify(target=senduser, url=send_notify_rederct_url, content=send_notify_content)
                
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
            
            if not comment.author == post.author:
                send_notify_rederct_url = '/@'+post.author.username+'/'+post.url
                send_notify_content = '\''+ post.title +'\'에 \''+ comment.author.username +'\'님의 새로운 댓글 : ' + comment.text
                create_notify(target=post.author, url=send_notify_rederct_url, content=send_notify_content)
            
            return HttpResponse(str(0))
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
    if not request.user == comment.author:
        return redirect('post_detail', username=comment.post.author, url=comment.post.url)
    if request.method == 'POST':
        form = CommentForm(request.POST, instance=comment)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.edit = True
            comment.save()
            return HttpResponse('done')
        else:
            return HttpResponse('fail')
    else:
        form = CommentForm(instance=comment)
        return render(request, 'board/small/comment_update.html',{ 'form':form })

def comment_remove(request, cpk):
    comment = Comment.objects.get(pk=cpk)
    if not comment.author == request.user:
        return HttpResponse(str(0))
    else:
        comment.delete()
        return HttpResponse(str(1))
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
    user_content = []
    for post in posts:
        user_content += [ [post.title, post.image, post.created_date, post.updated_date, post.text_md] ]
    return render(request, 'board/content_backup.html', {'user_content':user_content})

def post_list_in_tag(request, tag):
    posts = Post.objects.filter(created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag).order_by('created_date').reverse()
    if len(posts) == 0:
        raise Http404()
    paginator = Paginator(posts, 15)
    page = request.GET.get('page')
    pageposts = paginator.get_page(page)
    return render(request, 'board/post_list_in_tag.html',{ 'tag':tag, 'pageposts':pageposts, 'white_nav':True })
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
        'current_path': request.get_full_path()
    }

    get_series = request.GET.get('series')
    if get_series:
        render_args['get_series'] = True
        series = Series.objects.filter(name=get_series, owner=user, posts=post.id)
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
    
    return render(request, 'board/post_detail.html',  render_args)

def post_list(request):
    render_args = {
        'pageposts' : get_posts(''),
        'weekly_top' : get_posts('week-top')[:4],
        'white_nav' : True
    }

    if request.user.is_active:
        render_args['write_btn'] = True
    
    tags = get_clean_all_tags()
    alltaglist = []
    for tag in tags:
        alltaglist += [[len(Post.objects.filter(created_date__lte=timezone.now(), tag__iregex=r'\b%s\b' % tag)), tag]]
    # alltaglist.sort(key=lambda x:x[1])
    alltaglist.sort(reverse=True)
    render_args['tags'] = alltaglist
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
        'weekly_top' : get_posts('week-top')[:4],
        'white_nav' : True
    }

    if request.user.is_active:
        render_args['write_btn'] = True

    return render(request, 'board/post_sort_list.html', render_args)

def post_write(request):
    if not request.user.is_active:
        return redirect('post_list')
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.url = slugify(post.title, allow_unicode=True)
            if post.url == '':
                post.url = randstr(15)
            post.text_html = parsedown(post.text_md)
            i = 1
            while True:
                try:
                    post.save()
                    break
                except:
                    post.url = slugify(post.title+'-'+str(i), allow_unicode=True)
                    i += 1
            return redirect('post_detail', username=post.author, url=post.url)
    else:
        form = PostForm()
    return render(request, 'board/post_write.html',{ 'form':form })

def post_like(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.method == 'POST':
        user = User.objects.get(username=request.user)
        if post.likes.filter(id = user.id).exists():
            post.likes.remove(user)
            if post.trendy > 20 :
                post.trendy -= 20
            else :
                post.trendy = 0
            post.save()
        else:
            post.likes.add(user)
            date_sub = timezone.now() - post.last_like_date
            date_sub = int(date_sub.days)
            post.trendy += int(20/(date_sub + 1))
            post.last_like_date = timezone.now()
            post.save()

            send_notify_rederct_url = '/@'+post.author.username+'/'+post.url
            send_notify_content = '\''+ post.title +'\' 글을 \'' + user.username + '\'님께서 추천했습니다.'
            create_notify(target=post.author, url=send_notify_rederct_url, content=send_notify_content)

        return HttpResponse(str(post.total_likes()))
    return redirect('post_list')

def post_edit(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if not post.author == request.user:
        return redirect('post_detail', username=post.author, url=post.url)
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            post = form.save(commit=False)
            post.updated_date = timezone.now()
            post.text_html = parsedown(post.text_md)
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