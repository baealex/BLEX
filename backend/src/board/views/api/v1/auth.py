import re
import datetime
import traceback
import json

from django.conf import settings
from django.contrib import auth
from django.core.cache import cache
from django.contrib.auth.models import User
from django.core.files import File
from django.db.models import Count, Case, When, Value, Exists, OuterRef
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    TwoFactorAuth, Config, Profile, Post, Invitation,
    UserLinkMeta, UsernameChangeLog, TelegramSync, SocialAuthProvider)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from modules import oauth
from modules.challenge import auth_hcaptcha
from modules.sub_task import SubTaskProcessor
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


def login_response(user: User, is_first_login=False):
    _user = get_object_or_404(User.objects.select_related(
        'profile', 'config'
    ).annotate(
        notify_count=Count(
            Case(
                When(notify__has_read=False, then=Value(1))
            )
        ),
        has_connected_telegram=Exists(
            TelegramSync.objects.filter(
                user_id=OuterRef('id'),
                tid__regex=r'^.+'
            )
        ),
        has_connected_2fa=Exists(
            TwoFactorAuth.objects.filter(
                user_id=OuterRef('id')
            )
        ),
        has_editor_role=Exists(
            Invitation.objects.filter(
                receiver_id=OuterRef('id'),
            )
        ),
    ), id=user.id)

    return StatusDone({
        'username': _user.username,
        'name': _user.first_name,
        'email': _user.email,
        'avatar': _user.profile.avatar.url if _user.profile.avatar else '',
        'notify_count': _user.notify_count,
        'is_first_login': is_first_login,
        'has_connected_telegram': _user.has_connected_telegram,
        'has_connected_2fa': _user.has_connected_2fa,
        'has_editor_role': _user.has_editor_role,
    })


def common_auth(request, user):
    if not settings.DEBUG:
        if user.config.has_two_factor_auth():
            def create_auth_token():
                token = randnum(6)
                user.twofactorauth.create_token(token)
                bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
                bot.send_message(user.telegramsync.get_decrypted_tid(),
                                 f'2차 인증 코드입니다 : {token}')

            SubTaskProcessor.process(create_auth_token)
            return StatusDone({
                'username': user.username,
                'security': True,
            })
    auth.login(request, user)
    return login_response(request.user)


def create_user(username, name, email, avatar_url, token=None):
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
        first_name=name,
    )

    if token:
        user.last_name = token
        user.save()

    user_profile = Profile.objects.create(user=user)

    if avatar_url:
        avatar = download_image(avatar_url, stream=True)
        if avatar:
            user_profile.avatar.save(name='png', content=File(avatar))
            user_profile.save()

    user_config = Config.objects.create(user=user)
    user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_MENTION, 'true')
    user_config.create_or_update_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE, 'true')

    create_notify(
        user=user,
        url='https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca',
        content=(
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
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        # Server-side rate limiting check
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
        cache_key = f'login_attempts:{client_ip}'
        
        attempts = cache.get(cache_key, 0)
        
        # Block if too many attempts
        if attempts >= 5:
            return StatusError(ErrorCode.REJECT, '너무 많은 실패로 인해 잠시 후 다시 시도해주세요.')
        
        # Try to parse JSON first, then fallback to POST data
        try:
            data = json.loads(request.body.decode('utf-8')) if request.body else {}
            social = data.get('social', '') or request.POST.get('social', '')
            if not social:
                username = data.get('username', '') or request.POST.get('username', '')
                password = data.get('password', '') or request.POST.get('password', '')
                # hcaptcha_response = data.get('h-captcha-response', '') or request.POST.get('h-captcha-response', '')
        except (json.JSONDecodeError, UnicodeDecodeError):
            social = request.POST.get('social', '')
            if not social:
                username = request.POST.get('username', '')
                password = request.POST.get('password', '')
                # hcaptcha_response = request.POST.get('h-captcha-response', '')

            # Validate hCaptcha if attempts >= 3
            # if attempts >= 3:
            #     if not hcaptcha_response:
            #         return StatusError(ErrorCode.VALIDATE, '보안 검증이 필요합니다.')
            #     
            #     if settings.HCAPTCHA_SECRET_KEY and not auth_hcaptcha(hcaptcha_response):
            #         # Increment attempts for failed captcha
            #         cache.set(cache_key, attempts + 1, 300)  # 5 minutes
            #         return StatusError(ErrorCode.REJECT, '보안 검증에 실패했습니다.')

            user = auth.authenticate(username=username, password=password)

            if user is not None:
                if user.is_active:
                    # Reset attempts on successful login
                    cache.delete(cache_key)
                    return common_auth(request, user)
            else:
                # Increment failed attempts
                cache.set(cache_key, attempts + 1, 300)  # 5 minutes
                return StatusError(ErrorCode.AUTHENTICATION)
    raise Http404


def logout(request):
    if request.method == 'POST':
        if not request.user.is_active:
            return StatusError(ErrorCode.NEED_LOGIN)

        auth.logout(request)
        return StatusDone()
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

        username_error = check_username(username)
        if username_error:
            return StatusError(ErrorCode.REJECT, username_error)

        email_error = check_email(email)
        if email_error:
            return StatusError(ErrorCode.REJECT, email_error)

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
            # TODO: 이메일 인증 f'{settings.SITE_URL}/verify?token={token}'
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
            six_months_ago = timezone.now() - datetime.timedelta(days=180)
            if UsernameChangeLog.objects.filter(
                user=user,
                created_date__gte=six_months_ago
            ).exists():
                return StatusError(ErrorCode.REJECT, '6개월에 한번만 사용자 이름을 변경할 수 있습니다.')

            username = body.get('username', '')

            result_check_username = check_username(username)
            if result_check_username:
                return StatusError(ErrorCode.REJECT, result_check_username)

            if Post.objects.filter(author=request.user).exists():
                UsernameChangeLog.objects.create(
                    user=user,
                    username=user.username,
                )
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
                if not state.success:
                    return StatusError(ErrorCode.REJECT)

                avatar_url = state.user.get('avatar_url')
                node_id = state.user.get('node_id')
                user_id = state.user.get('login')
                name = state.user.get('name')
                token = f'{social}:{node_id}'

                users = User.objects.filter(last_name=token)
                if users.exists():
                    return common_auth(request, users.first())

                user, profile, config = create_user(
                    username=user_id,
                    name=name,
                    email='',
                    avatar_url=avatar_url,
                    token=token,
                )

                UserLinkMeta.objects.create(
                    user=user,
                    name='github',
                    value=f'https://github.com/{user_id}'
                )

                auth.login(request, user)
                return login_response(request.user, is_first_login=True)

        if social == 'google':
            if request.POST.get('code'):
                state = oauth.auth_google(request.POST.get('code'))
                if not state.success:
                    return StatusError(ErrorCode.REJECT)

                avatar_url = state.user.get('picture')
                node_id = state.user.get('id')
                user_id = state.user.get('email').split('@')[0]
                email = state.user.get('email')
                name = state.user.get('name')
                token = f'{social}:{node_id}'

                users = User.objects.filter(last_name=token)
                if users.exists():
                    return common_auth(request, users.first())

                user, profile, config = create_user(
                    username=user_id,
                    name=name,
                    email=email,
                    avatar_url=avatar_url,
                    token=token,
                )

                auth.login(request, user)
                return login_response(request.user, is_first_login=True)

    raise Http404


def email_verify(request, token):
    user = get_object_or_404(User, last_name='email:' + token)

    if request.method == 'GET':
        return StatusDone({
            'first_name': user.first_name
        })

    if request.method == 'POST':
        if user.is_active:
            return StatusError(ErrorCode.ALREADY_VERIFICATION)

        if user.date_joined < timezone.now() - datetime.timedelta(days=7):
            return StatusError(ErrorCode.EXPIRED)

        if settings.HCAPTCHA_SECRET_KEY:
            hctoken = request.POST.get('hctoken', '')
            if not hctoken:
                return StatusError(ErrorCode.VALIDATE)

            if not auth_hcaptcha(hctoken):
                return StatusError(ErrorCode.REJECT)

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
            content=(
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
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        if not request.user.config.has_telegram_id():
            return StatusError(ErrorCode.NEED_TELEGRAM)

        if hasattr(request.user, 'twofactorauth'):
            return StatusError(ErrorCode.ALREADY_CONNECTED)

        recovery_key = randstr(45)
        # TODO: 이메일로 복구키 전송

        two_factor_auth = TwoFactorAuth(user=request.user)
        two_factor_auth.recovery_key = recovery_key
        two_factor_auth.save()
        return StatusDone()

    if request.method == 'DELETE':
        if not hasattr(request.user, 'twofactorauth'):
            return StatusError(ErrorCode.ALREADY_DISCONNECTED)

        if not request.user.twofactorauth.has_been_a_day():
            return StatusError(ErrorCode.REJECT, '24시간 동안 해제할 수 없습니다.')

        request.user.twofactorauth.delete()
        return StatusDone()

    raise Http404


def security_send(request):
    if request.method == 'POST':
        # Server-side 2FA rate limiting
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
        cache_key = f'2fa_attempts:{client_ip}'
        
        attempts = cache.get(cache_key, 0)
        
        # Block if too many 2FA attempts
        if attempts >= 5:
            return StatusError(ErrorCode.REJECT, '너무 많은 실패로 인해 5분 동안 차단되었습니다.')

        body = QueryDict(request.body)
        auth_token = body.get('auth_token', '')
        code = body.get('code', '')  # For the new 2FA flow
        
        try:
            # Handle 6-digit 2FA code
            verification_code = code or auth_token
            if len(verification_code) == 6:
                two_factor_auth = TwoFactorAuth.objects.get(otp=verification_code)
                if two_factor_auth:
                    if two_factor_auth.is_token_expire():
                        return StatusError(ErrorCode.EXPIRED)
                    user = two_factor_auth.user
                    two_factor_auth.otp = ''
                    two_factor_auth.save()
                    
                    # Reset 2FA attempts on success
                    cache.delete(cache_key)
                    
                    # Clear OAuth 2FA session data if exists
                    if 'pending_2fa_user_id' in request.session:
                        del request.session['pending_2fa_user_id']
                        del request.session['pending_2fa_username']
                    
                    auth.login(request, user)
                    return login_response(request.user)
            # Handle recovery key
            elif len(verification_code) > 6:
                two_factor_auth = TwoFactorAuth.objects.get(
                    recovery_key=verification_code)
                if two_factor_auth:
                    user = two_factor_auth.user
                    two_factor_auth.otp = ''
                    two_factor_auth.save()
                    
                    # Reset 2FA attempts on success
                    cache.delete(cache_key)
                    
                    # Clear OAuth 2FA session data if exists
                    if 'pending_2fa_user_id' in request.session:
                        del request.session['pending_2fa_user_id']
                        del request.session['pending_2fa_username']
                    
                    auth.login(request, user)
                    return login_response(request.user)
        except Exception as e:
            traceback.print_exc()

        # Increment failed 2FA attempts
        cache.set(cache_key, attempts + 1, 300)  # 5 minutes
        return StatusError(ErrorCode.REJECT)

    raise Http404


def social_providers(request):
    """
    Get available social authentication providers
    """
    if request.method == 'GET':
        providers = SocialAuthProvider.objects.all().values('key', 'name', 'icon', 'color')
        return StatusDone(list(providers))
    raise Http404
