import re
import time
import traceback

from django.conf import settings
from django.contrib import auth
from django.core.files import File
from django.core.mail import send_mail
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import *
from board.module.subtask import sub_task_manager
from board.module.telegram import TelegramBot
from board.module.response import StatusDone, StatusError
from board.views import function as fn

def common_auth(request, user):
    if not settings.DEBUG:
        if user.config.has_two_factor_auth():
            def create_auth_token():
                token = randnum(6)
                user.twofactorauth.create_token(token)
                bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
                bot.send_message(user.telegramsync.tid, f'2차 인증 코드입니다 : {token}')
            sub_task_manager.append(create_auth_token)
            return StatusDone({
                'username': user.username,
                'security': True,
            })
    auth.login(request, user)
    notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
    return StatusDone({
        'username': user.username,
        'notify_count': notify.count()
    })

def login(request):
    if request.method == 'GET':
        if request.user.is_active:
            notify = Notify.objects.filter(user=request.user, is_read=False).order_by('-created_date')
            return StatusDone({
                'username': request.user.username,
                'notify_count': notify.count(),
            })
        return StatusError('NL')
    
    if request.method == 'POST':
        social = request.POST.get('social', '')
        if not social:
            username = request.POST.get('username', '')
            password = request.POST.get('password', '')
            
            user = auth.authenticate(username=username, password=password)

            if user is not None:
                if user.is_active:
                    return common_auth(request, user)
            return StatusError('DU')
    raise Http404

def logout(request):
    if request.method == 'POST':
        if request.user.is_active:
            auth.logout(request)
            return StatusDone()
        return StatusError('NL')
    raise Http404

def sign(request):
    if request.method == 'POST':
        username = request.POST.get('username', '')
        realname = request.POST.get('realname', '')
        password = request.POST.get('password', '')
        email = request.POST.get('email', '')

        has_username = User.objects.filter(username=username)
        if has_username.exists():
            return StatusError('AE')

        regex = re.compile('[a-z0-9]{4,15}')
        if not regex.match(username) or not len(regex.match(username).group()) == len(username):
            return StatusError('UN')

        regex = re.compile('[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}')
        if not regex.match(email) or not len(regex.match(email).group()) == len(email):
            return StatusError('EN')

        token = randstr(35)
        has_token = User.objects.filter(last_name=token)
        while has_token.exists():
            token = randstr(35)
            has_token = User.objects.filter(last_name=token)

        new_user = User.objects.create_user(
           username,
           email,
           password
        )
        new_user.first_name = realname;
        new_user.last_name = 'email:' + token
        new_user.is_active = False
        new_user.save()

        sub_task_manager.append(lambda: send_mail(
            subject = '[ BLEX ] 이메일을 인증해 주세요!',
            message = settings.SITE_URL + '/verify?token=' + token,
            from_email = 'im@baejino.com',
            recipient_list = [new_user.email],
        ))
        return StatusDone()
    
    if request.method == 'DELETE':
        request.user.delete()
        auth.logout(request)
        return StatusDone()
    
    raise Http404

def sign_social(request, social):
    if request.method == 'POST':
        if social == 'github':
            if request.POST.get('code'):
                state = fn.auth_github(request.POST.get('code'))
                if state['status']:
                    node_id = state['user'].get('node_id')
                    try:
                        user = User.objects.get(last_name='github:' + str(node_id))
                        return common_auth(request, user)
                    except:
                        traceback.print_exc()
                        
                    counter = 0
                    username = state['user'].get('login')
                    has_name = User.objects.filter(username=username)
                    while len(has_name) > 0:
                        has_name = User.objects.filter(username=username + str(counter))
                        counter += 1
                    
                    username = username + str('' if counter == 0 else counter)
                    new_user = User(username=username)
                    new_user.first_name = state['user'].get('name')
                    new_user.last_name = 'github:' + str(node_id)
                    new_user.email = state['user'].get('email')
                    new_user.is_active = True
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = fn.get_image(state['user'].get('avatar_url'))
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.github = state['user'].get('login')
                    profile.save()

                    config = Config(user=new_user)
                    config.save()

                    fn.create_notify(user=new_user, url='/notion', infomation=new_user.first_name + (
                        '님의 가입을 진심으로 환영합니다! 블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 \'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'))

                    auth.login(request, new_user)
                    return StatusDone({
                        'username': username,
                        'notify_count': 1
                    })
                return StatusError('RJ')
        
        if social == 'google':
            if request.POST.get('code'):
                state = fn.auth_google(request.POST.get('code'))
                if state['status']:
                    node_id = state['user'].get('id')
                    try:
                        user = User.objects.get(last_name='google:' + str(node_id))
                        return common_auth(request, user)
                    except:
                        traceback.print_exc()
                    
                    counter = 0
                    username = state['user'].get('email').split('@')[0]
                    has_name = User.objects.filter(username=username)
                    while len(has_name) > 0:
                        has_name = User.objects.filter(username=username + str(counter))
                        counter += 1
                    
                    username = username + str('' if counter == 0 else counter)
                    new_user = User(username=username)
                    new_user.first_name = state['user'].get('name')
                    new_user.last_name = 'google:' + str(node_id)
                    new_user.email = state['user'].get('email')
                    new_user.is_active = True
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = fn.get_image(state['user'].get('picture'))
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.save()

                    config = Config(user=new_user)
                    config.save()

                    fn.create_notify(user=new_user, url='/notion', infomation=new_user.first_name + (
                        '님의 가입을 진심으로 환영합니다! 블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 \'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'))

                    auth.login(request, new_user)
                    return StatusDone({
                        'username': username,
                        'notify_count': 1
                    })
                return StatusError('RJ')
    raise Http404

def email_verify(request, token):
    user = get_object_or_404(User, last_name='email:' + token)
    
    if request.method == 'GET':
        return StatusDone({
            'first_name': user.first_name
        })
    
    if request.method == 'POST':
        if user.is_active:
            return StatusError('AV')

        if user.date_joined < timezone.now() - datetime.timedelta(days=7):
            return StatusError('EP')
        
        if settings.HCAPTCHA_SECRET_KEY:
            hctoken = request.POST.get('hctoken', '')
            if not hctoken:
                return StatusError('RJ')
            if not fn.auth_hcaptcha(hctoken):
                return StatusError('RJ')
        
        user.is_active = True
        user.last_name = ''
        user.save()

        profile = Profile(user=user)
        profile.save()

        config = Config(user=user)
        config.save()
        
        fn.create_notify(user=user, url='/notion', infomation=user.first_name + (
            '님의 가입을 진심으로 환영합니다! 블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 \'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'))

        auth.login(request, user)
        return StatusDone({
            'username': user.username,
            'notify_count': 1
        })
    raise Http404

def security(request):
    if not request.user.is_active:
        return StatusError('NL')
    
    if request.method == 'POST':
        if not request.user.config.has_telegram_id():
            return StatusError('NT')
        
        if hasattr(request.user, 'twofactorauth'):
            return StatusError('AE')

        recovery_key = randstr(45)

        sub_task_manager.append(lambda: send_mail(
            subject='[ BLEX ] 2차 인증 복구키',
            message=f'핸드폰을 사용할 수 없다면 이 복구키를 사용하여 로그인 하십시오.\n\n{recovery_key}',
            from_email='im@baejino.com',
            recipient_list=[request.user.email],
        ))

        two_factor_auth = TwoFactorAuth(user=request.user)
        two_factor_auth.recovery_key = recovery_key
        two_factor_auth.save()
        return StatusDone()
    
    if request.method == 'DELETE':
        if not hasattr(request.user, 'twofactorauth'):
            return StatusError('AU')
        
        if not request.user.twofactorauth.has_been_a_day():
            return StatusError('RJ')
        
        request.user.twofactorauth.delete()
        return StatusDone()

    raise Http404

def security_send(request):
    if request.method == 'POST':
        body = QueryDict(request.body)
        auth_token = body.get('auth_token', '')
        try:
            if len(auth_token) == 6:
                two_factor_auth = TwoFactorAuth.objects.get(one_pass_token=auth_token)
                if two_factor_auth:
                    if two_factor_auth.is_token_expire():
                        return StatusError('EP')
                    user = two_factor_auth.user
                    two_factor_auth.one_pass_token = ''
                    two_factor_auth.save()
                    auth.login(request, user)
                    notify = Notify.objects.filter(user=user, is_read=False).order_by('-created_date')
                    return StatusDone({
                        'username': request.user.username,
                        'notify_count': notify.count(),
                    })
            else:
                two_factor_auth = TwoFactorAuth.objects.get(recovery_key=auth_token)
                if two_factor_auth:
                    user = two_factor_auth.user
                    two_factor_auth.one_pass_token = ''
                    two_factor_auth.save()
                    auth.login(request, user)
                    notify = Notify.objects.filter(user=user, is_read=False).order_by('-created_date')
                    return StatusDone({
                        'username': request.user.username,
                        'notify_count': notify.count(),
                    })
        except:
            traceback.print_exc()

        return StatusError('RJ')
    
    raise Http404