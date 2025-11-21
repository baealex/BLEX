import datetime
import traceback
import json

from django.conf import settings
from django.contrib import auth
from django.core.cache import cache
from django.contrib.auth.models import User
from django.db.models import Count, Case, When, Value, Exists, OuterRef
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import (
    TwoFactorAuth, Config, Profile, Post,
    UserLinkMeta, UsernameChangeLog, TelegramSync, SocialAuthProvider, SiteSetting)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_service import AuthService, AuthValidationError
from modules import oauth
from modules.challenge import auth_hcaptcha
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot
from modules.randomness import randnum, randstr


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
        'has_editor_role': _user.profile.is_editor(),
    })


def common_auth(request, user):
    # Check if 2FA is required
    if AuthService.check_two_factor_auth(user):
        # Send 2FA token via Telegram
        AuthService.send_2fa_token(user)
        return StatusDone({
            'username': user.username,
            'security': True,
        })
    # No 2FA required, proceed with login
    auth.login(request, user)
    return login_response(request.user)


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
        except (json.JSONDecodeError, UnicodeDecodeError):
            data = {}

        social = data.get('social', '') or request.POST.get('social', '')
        if not social:
            username = data.get('username', '') or request.POST.get('username', '')
            password = data.get('password', '') or request.POST.get('password', '')
            # hcaptcha_response = data.get('h-captcha-response', '') or request.POST.get('h-captcha-response', '')

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
        hcaptcha_response = request.POST.get('h-captcha-response', '')

        try:
            AuthService.validate_username(username)
            AuthService.validate_email(email)
        except AuthValidationError as e:
            return StatusError(e.code, e.message)

        # Verify HCaptcha if HCAPTCHA_SECRET_KEY is set
        if settings.HCAPTCHA_SECRET_KEY:
            if not hcaptcha_response:
                return StatusError(ErrorCode.VALIDATE, '보안 검증이 필요합니다.')
            if not auth_hcaptcha(hcaptcha_response):
                return StatusError(ErrorCode.REJECT, '보안 검증에 실패했습니다.')

        # Create user using AuthService
        new_user, profile, config = AuthService.create_user(
            username=username,
            name=name,
            email=email,
            password=password
        )

        auth.login(request, new_user)
        return login_response(request.user, is_first_login=True)

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

            # Validate username using AuthService
            try:
                AuthService.validate_username(username)
            except AuthValidationError as e:
                return StatusError(e.code, e.message)

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
        AuthService.delete_user_account(request.user)
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

                user, profile, config = AuthService.create_user(
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

                user, profile, config = AuthService.create_user(
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

        AuthService.send_welcome_notification(user)

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
        username = body.get('username', '')  # Username to verify against

        try:
            verification_code = code or auth_token

            if not verification_code or len(verification_code) < 6:
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.VALIDATE, '인증 코드를 입력해주세요.')

            # Find user by username if provided, or by OTP/recovery key
            user = None
            if username:
                try:
                    user = User.objects.get(username=username)
                except User.DoesNotExist:
                    cache.set(cache_key, attempts + 1, 300)
                    return StatusError(ErrorCode.REJECT)
            else:
                # Try to find user by OTP or recovery key
                try:
                    if len(verification_code) == 6:
                        two_factor_auth = TwoFactorAuth.objects.get(otp=verification_code)
                        user = two_factor_auth.user
                    else:
                        two_factor_auth = TwoFactorAuth.objects.get(recovery_key=verification_code)
                        user = two_factor_auth.user
                except TwoFactorAuth.DoesNotExist:
                    cache.set(cache_key, attempts + 1, 300)
                    return StatusError(ErrorCode.REJECT)

            # Verify token using AuthService
            if user and AuthService.verify_2fa_token(user, verification_code):
                # Reset 2FA attempts on success
                cache.delete(cache_key)

                # Clear OAuth 2FA session data if exists
                if 'pending_2fa_user_id' in request.session:
                    del request.session['pending_2fa_user_id']
                    del request.session['pending_2fa_username']

                auth.login(request, user)
                return login_response(request.user)
            else:
                # Verification failed
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.REJECT)

        except Exception as e:
            traceback.print_exc()
            cache.set(cache_key, attempts + 1, 300)
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
