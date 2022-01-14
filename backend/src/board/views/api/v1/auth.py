import re
import time
import datetime
import traceback

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.models import User
from django.core.files import File
from django.core.mail import send_mail
from django.db.models import Q
from django.http import HttpResponse, JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.timesince import timesince

from board.models import Notify, TwoFactorAuth, Config, Profile
from board.modules.notify import create_notify
from modules.challenge import auth_hcaptcha
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot
from modules.oauth import auth_github, auth_google
from modules.randomness import randnum, randstr
from modules.response import StatusDone, StatusError
from modules.scrap import download_image

def login_response(user):
    username = user.username
    avatar = str(user.profile.avatar)
    notify = Notify.objects.filter(
        user=user,
        is_read=False
    ).order_by('-created_date')

    return StatusDone({
        'username': user.username,
        'avatar': avatar,
        'notify': list(map(lambda item: {
            'pk': item.pk,
            'url': item.url,
            'is_read': item.is_read,
            'content': item.infomation,
            'created_date': timesince(item.created_date)
        }, notify)),
        'is_telegram_sync': user.config.has_telegram_id(),
        'is_2fa_sync': user.config.has_two_factor_auth(),
    })

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
    return login_response(request.user)

def login(request):
    if request.method == 'GET':
        if request.user.is_active:
            return login_response(request.user)
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
            return StatusError('AE', '😥 이미 사용중인 사용자 이름 입니다.')
        
        regex = re.compile('[a-z0-9]{4,15}')
        if not regex.match(username) or not len(regex.match(username).group()) == len(username):
            return StatusError('UN', '😥 사용자 이름은 4~15자 사이의 영어, 숫자만 가능합니다.')

        regex = re.compile('[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}')
        if not regex.match(email) or not len(regex.match(email).group()) == len(email):
            return StatusError('EN', '😥 올바른 이메일 주소가 아닙니다.')

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
        new_user.first_name = realname

        if not settings.DEBUG:
            new_user.last_name = 'email:' + token
            new_user.is_active = False

            sub_task_manager.append(lambda: send_mail(
                subject='[ BLEX ] 이메일을 인증해 주세요!',
                message=f'{settings.SITE_URL}/verify?token={token}',
                from_email='im@baejino.com',
                recipient_list=[new_user.email],
            ))
            new_user.save()
        else:
            new_user.save()

            profile = Profile(user=new_user)
            profile.save()

            config = Config(user=new_user)
            config.save()
        
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
                state = auth_github(request.POST.get('code'))
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
                    new_user.email = ''
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = download_image(state['user'].get('avatar_url'), stream=True)
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.github = state['user'].get('login')
                    profile.save()

                    config = Config(user=new_user)
                    config.save()

                    create_notify(
                        user=new_user,
                        url='https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca',
                        infomation=(
                            f'{new_user.first_name}님의 가입을 진심으로 환영합니다! '
                            f'블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 '
                            f'\'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'
                        )
                    )
                    auth.login(request, new_user)
                    return login_response(request.user)
                return StatusError('RJ')
        
        if social == 'google':
            if request.POST.get('code'):
                state = auth_google(request.POST.get('code'))
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
                    new_user.email = ''
                    new_user.save()

                    profile = Profile(user=new_user)
                    avatar = download_image(state['user'].get('picture'), stream=True)
                    if avatar:
                        profile.avatar.save(name='png', content=File(avatar))
                    profile.save()

                    config = Config(user=new_user)
                    config.save()

                    create_notify(
                        user=new_user,
                        url='https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca',
                        infomation=(
                            f'{new_user.first_name}님의 가입을 진심으로 환영합니다! '
                            f'블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 '
                            f'\'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'
                        )
                    )

                    auth.login(request, new_user)
                    return login_response(request.user)
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
            if not auth_hcaptcha(hctoken):
                return StatusError('RJ')
        
        user.is_active = True
        user.last_name = ''
        user.save()

        profile = Profile(user=user)
        profile.save()

        config = Config(user=user)
        config.save()
        
        create_notify(
            user=user,
            url='https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca',
            infomation=(
                f'{user.first_name}님의 가입을 진심으로 환영합니다! '
                f'블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 '
                f'\'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'
            )
        )

        auth.login(request, user)
        return login_response(request.user)
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
                    return login_response(request.user)
            else:
                two_factor_auth = TwoFactorAuth.objects.get(recovery_key=auth_token)
                if two_factor_auth:
                    user = two_factor_auth.user
                    two_factor_auth.one_pass_token = ''
                    two_factor_auth.save()
                    auth.login(request, user)
                    return login_response(request.user)
        except:
            traceback.print_exc()

        return StatusError('RJ')
    
    raise Http404