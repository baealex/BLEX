import re
import datetime
import traceback

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.models import User
from django.core.files import File
from django.core.mail import send_mail
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import Notify, TwoFactorAuth, Config, Profile, Post, Comment
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError
from modules import oauth
from modules.challenge import auth_hcaptcha
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot
from modules.randomness import randnum, randstr
from modules.scrap import download_image


def check_username(username: str):
    has_username = User.objects.filter(username=username)
    if has_username.exists():
        return '이미 사용중인 사용자 이름 입니다.'

    regex = re.compile('[a-z0-9]{4,15}')
    if not regex.match(username) or not len(regex.match(username).group()) == len(username):
        return '사용자 이름은 4~15자 사이의 소문자 영어, 숫자만 가능합니다.'


def check_email(email: str):
    regex = re.compile('[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}')
    if not regex.match(email) or not len(regex.match(email).group()) == len(email):
        return '올바른 이메일 주소가 아닙니다.'


def login_response(user, is_first_login=False):
    avatar = str(user.profile.avatar)
    notify_count = Notify.objects.filter(
        user=user,
        is_read=False
    ).count()

    return StatusDone({
        'username': user.username,
        'name': user.first_name,
        'email': user.email,
        'avatar': avatar,
        'notify_count': notify_count,
        'is_first_login': is_first_login,
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


def create_user_from_social(token, username, name, email, avatar_url):
    counter = 0
    created_username = username.lower()
    user = User.objects.filter(username=created_username)
    while user.exists():
        counter += 1
        created_username = f'{username}{counter}'
        user = User.objects.filter(username=created_username)

    user = User.objects.create_user(
        username=created_username,
        email=email,
        last_name=token,
        first_name=name,
    )

    user_profile = Profile.objects.create(user=user)

    if avatar_url:
        avatar = download_image(avatar_url, stream=True)
        if avatar:
            user_profile.avatar.save(name='png', content=File(avatar))
            user_profile.save()

    user_config = Config.objects.create(user=user)

    create_notify(
        user=user,
        url='https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca',
        infomation=(
            f'{user.first_name}님의 가입을 진심으로 환영합니다! '
            f'블렉스의 다양한 기능을 활용하고 싶으시다면 개발자가 직접 작성한 '
            f'\'블렉스 노션\'을 살펴보시는 것을 추천드립니다 :)'
        )
    )

    return [user, user_profile, user_config]


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
    if request.method == 'GET':
        username = request.GET.get('username')
        if User.objects.filter(username=username).exists():
            return StatusDone({
                'is_available': False,
            })
        return StatusDone({
            'is_available': True,
        })

    if request.method == 'POST':
        username = request.POST.get('username', '')
        name = request.POST.get('name', '')
        password = request.POST.get('password', '')
        email = request.POST.get('email', '')

        result_check_username = check_username(username)
        if result_check_username:
            return StatusError('RJ', result_check_username)

        result_check_email = check_email(email)
        if result_check_email:
            return StatusError('RJ', result_check_email)

        new_user = User.objects.create_user(
            username,
            email,
            password
        )
        new_user.first_name = name

        if not settings.DEBUG and not settings.TESTING:
            token = randstr(35)
            has_token = User.objects.filter(last_name='email:' + token)
            while has_token.exists():
                token = randstr(35)
                has_token = User.objects.filter(last_name='email:' + token)

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

    if request.method == 'PATCH':
        user = request.user
        body = QueryDict(request.body)

        if body.get('username', ''):
            if Post.objects.filter(author=request.user).count() > 0:
                return StatusError('RJ', '이미 작성하신 포스트가 있습니다.')

            if Comment.objects.filter(author=request.user).count() > 0:
                return StatusError('RJ', '이미 작성하신 댓글이 있습니다.')

            username = body.get('username', '')

            result_check_username = check_username(username)
            if result_check_username:
                return StatusError('RJ', result_check_username)

            user.username = username

        if body.get('name', ''):
            user.first_name = body.get('name', '')

        user.save()
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
                state = oauth.auth_github(request.POST.get('code'))
                if state.success:
                    avatar_url = state.user.get('avatar_url')
                    node_id = state.user.get('node_id')
                    user_id = state.user.get('login')
                    name = state.user.get('name')
                    token = f'{social}:{node_id}'

                    users = User.objects.filter(last_name=token)
                    if users.exists():
                        return common_auth(request, users.first())

                    user, profile, config = create_user_from_social(
                        username=user_id,
                        name=name,
                        email='',
                        avatar_url=avatar_url,
                        token=token,
                    )

                    profile.github = user_id
                    profile.save()

                    auth.login(request, user)
                    return login_response(request.user, is_first_login=True)
                return StatusError('RJ')

        if social == 'google':
            if request.POST.get('code'):
                state = oauth.auth_google(request.POST.get('code'))
                if state.success:
                    avatar_url = state.user.get('picture')
                    node_id = state.user.get('id')
                    user_id = state.user.get('email').split('@')[0]
                    email = state.user.get('email')
                    name = state.user.get('name')
                    token = f'{social}:{node_id}'

                    users = User.objects.filter(last_name=token)
                    if users.exists():
                        return common_auth(request, users.first())

                    user, profile, config = create_user_from_social(
                        username=user_id,
                        name=name,
                        email=email,
                        avatar_url=avatar_url,
                        token=token,
                    )

                    auth.login(request, user)
                    return login_response(request.user, is_first_login=True)
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
