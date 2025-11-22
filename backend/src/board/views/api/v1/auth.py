import datetime
import traceback
import json
import io
import pyotp
import qrcode
import base64

from django.conf import settings
from django.contrib import auth
from django.core.cache import cache
from django.contrib.auth.models import User
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import (
    TwoFactorAuth, Config, Profile, Post,
    UserLinkMeta, UsernameChangeLog, TelegramSync, SocialAuthProvider, SiteSetting)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_service import AuthService, OAuthService, AuthValidationError
from modules import oauth
from modules.challenge import auth_hcaptcha
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot
from modules.randomness import randnum, randstr


def login_response(user: User, is_first_login=False):
    data = AuthService.get_user_login_data(user)
    data['is_first_login'] = is_first_login
    return StatusDone(data)


def common_auth(request, user, two_factor_code=None, is_oauth=False):
    """
    Handle authentication with optional 2FA code.

    Args:
        request: HTTP request
        user: Authenticated user
        two_factor_code: Optional 2FA code from client
        is_oauth: Whether this is OAuth authentication

    Returns:
        StatusDone with login data or security requirement
    """
    if AuthService.check_two_factor_auth(user):
        if two_factor_code:
            client_ip = get_client_ip(request)
            cache_key = f'login_attempts:{client_ip}'

            if AuthService.verify_totp_token(user, two_factor_code):
                cache.delete(cache_key)
                auth.login(request, user)
                return login_response(request.user)
            else:
                cache.set(cache_key, cache.get(cache_key, 0) + 1, 300)
                return StatusError(ErrorCode.REJECT, '2차 인증 코드가 올바르지 않습니다.')
        else:
            return StatusDone({
                'username': user.username,
                'security': True,
                'is_oauth': is_oauth,
            })

    auth.login(request, user)
    return login_response(request.user)


def parse_login_request(request):
    """Parse login request data from JSON or POST"""
    try:
        return json.loads(request.body.decode('utf-8')) if request.body else {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def get_client_ip(request):
    """Get client IP address from request"""
    return request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))


def check_login_rate_limit(request):
    """
    Check login rate limiting for the client IP.
    Returns StatusError if blocked, None otherwise.
    """
    client_ip = get_client_ip(request)
    cache_key = f'login_attempts:{client_ip}'
    attempts = cache.get(cache_key, 0)

    if attempts >= 5:
        return StatusError(ErrorCode.REJECT, '너무 많은 실패로 인해 잠시 후 다시 시도해주세요.')

    return None


def handle_oauth_token_login(request, data):
    """Handle OAuth token-based login with 2FA"""
    client_ip = get_client_ip(request)
    oauth_token = data.get('oauth_token', '') or request.POST.get('oauth_token', '')
    two_factor_code = data.get('code', '') or request.POST.get('code', '')

    oauth_data = OAuthService.get_2fa_data(oauth_token)

    if not oauth_data:
        return StatusError(ErrorCode.REJECT, '인증 토큰이 만료되었습니다. 다시 로그인해주세요.')

    try:
        user = User.objects.get(id=oauth_data['user_id'])
    except User.DoesNotExist:
        OAuthService.delete_2fa_token(oauth_token)
        return StatusError(ErrorCode.REJECT)

    if not two_factor_code:
        return StatusError(ErrorCode.VALIDATE, '2차 인증 코드가 필요합니다.')

    cache_key = f'login_attempts:{client_ip}'

    if AuthService.verify_totp_token(user, two_factor_code):
        cache.delete(cache_key)
        OAuthService.delete_2fa_token(oauth_token)
        auth.login(request, user)
        return login_response(request.user)
    else:
        cache.set(cache_key, cache.get(cache_key, 0) + 1, 300)
        return StatusError(ErrorCode.REJECT, '2차 인증 코드가 올바르지 않습니다.')


def handle_password_login(request, data):
    """Handle username/password-based login with optional 2FA"""
    client_ip = get_client_ip(request)
    cache_key = f'login_attempts:{client_ip}'

    username = data.get('username', '') or request.POST.get('username', '')
    password = data.get('password', '') or request.POST.get('password', '')
    two_factor_code = data.get('code', '') or request.POST.get('code', '')

    user = auth.authenticate(username=username, password=password)

    if user is not None:
        if user.is_active:
            cache.delete(cache_key)
            return common_auth(request, user, two_factor_code=two_factor_code)
    else:
        cache.set(cache_key, cache.get(cache_key, 0) + 1, 300)
        return StatusError(ErrorCode.AUTHENTICATION)


def login(request):
    if request.method == 'GET':
        if request.user.is_active:
            return login_response(request.user)
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        rate_limit_error = check_login_rate_limit(request)
        if rate_limit_error:
            return rate_limit_error

        data = parse_login_request(request)

        oauth_token = data.get('oauth_token', '') or request.POST.get('oauth_token', '')
        if oauth_token:
            return handle_oauth_token_login(request, data)
        else:
            return handle_password_login(request, data)

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

            # Change username using AuthService
            try:
                # Only create change log if user has posts
                create_log = Post.objects.filter(author=request.user).exists()
                AuthService.change_username(user, username, create_log=create_log)
            except AuthValidationError as e:
                return StatusError(e.code, e.message)

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
                    return common_auth(request, users.first(), is_oauth=True)

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
                    return common_auth(request, users.first(), is_oauth=True)

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

    if request.method == 'GET':
        # Return QR code for existing 2FA setup (so user can reconfigure their app if needed)
        if hasattr(request.user, 'twofactorauth'):
            two_factor_auth = request.user.twofactorauth
            qr_code = AuthService.get_totp_qr_code(request.user)
            if qr_code:
                return StatusDone({
                    'qr_code': qr_code,
                    'recovery_key': two_factor_auth.recovery_key
                })
        return StatusError(ErrorCode.NOT_FOUND)

    if request.method == 'POST':
        try:
            # Check if 2FA already exists
            if hasattr(request.user, 'twofactorauth'):
                return StatusError(ErrorCode.ALREADY_CONNECTED)

            # Generate TOTP secret and recovery key
            totp_secret = AuthService.create_totp_secret()
            recovery_key = randstr(45)

            # Store in session (NOT database yet - wait for verification)
            request.session['totp_setup'] = {
                'secret': totp_secret,
                'recovery_key': recovery_key,
                'user_id': request.user.id
            }

            # Generate QR code using temporary TOTP object
            totp = pyotp.TOTP(totp_secret)
            provisioning_uri = totp.provisioning_uri(
                name=request.user.email,
                issuer_name='BLEX'
            )

            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(provisioning_uri)
            qr.make(fit=True)

            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            qr_code = f"data:image/png;base64,{img_str}"

            return StatusDone({
                'qr_code': qr_code,
                'recovery_key': recovery_key
            })
        except Exception as e:
            traceback.print_exc()
            return StatusError(ErrorCode.ERROR, f'2FA 설정 초기화에 실패했습니다: {str(e)}')

    if request.method == 'DELETE':
        if not hasattr(request.user, 'twofactorauth'):
            return StatusError(ErrorCode.ALREADY_DISCONNECTED)

        if not request.user.twofactorauth.has_been_a_day():
            return StatusError(ErrorCode.REJECT, '24시간 동안 해제할 수 없습니다.')

        request.user.twofactorauth.delete()
        return StatusDone()

    raise Http404


def security_verify(request):
    """Verify TOTP code and complete 2FA setup"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        try:
            # Get setup data from session
            setup_data = request.session.get('totp_setup')
            if not setup_data:
                return StatusError(ErrorCode.ERROR, '2FA 설정 세션이 만료되었습니다. 다시 시도해주세요.')

            if setup_data['user_id'] != request.user.id:
                return StatusError(ErrorCode.ERROR, '잘못된 세션입니다.')

            # Check if 2FA already exists
            if hasattr(request.user, 'twofactorauth'):
                del request.session['totp_setup']
                return StatusError(ErrorCode.ALREADY_CONNECTED)

            # Get verification code from request
            data = json.loads(request.body.decode('utf-8')) if request.body else {}
            code = data.get('code', '').strip()

            if not code:
                return StatusError(ErrorCode.ERROR, '인증 코드를 입력해주세요.')

            # Verify the TOTP code
            totp = pyotp.TOTP(setup_data['secret'])
            if not totp.verify(code, valid_window=1):
                return StatusError(ErrorCode.REJECT, '잘못된 인증 코드입니다.')

            # Verification successful - save to database
            two_factor_auth = TwoFactorAuth(user=request.user)
            two_factor_auth.totp_secret = setup_data['secret']
            two_factor_auth.recovery_key = setup_data['recovery_key']
            two_factor_auth.save()

            # Clear session
            del request.session['totp_setup']

            return StatusDone({'message': '2차 인증이 활성화되었습니다.'})

        except Exception as e:
            traceback.print_exc()
            return StatusError(ErrorCode.ERROR, f'2FA 활성화에 실패했습니다: {str(e)}')

    raise Http404


def security_send(request):
    """
    DEPRECATED: This endpoint is kept for backwards compatibility.
    New clients should use /v1/login with the 'code' parameter instead.
    """
    if request.method == 'POST':
        client_ip = get_client_ip(request)
        cache_key = f'login_attempts:{client_ip}'
        attempts = cache.get(cache_key, 0)

        if attempts >= 5:
            return StatusError(ErrorCode.REJECT, '너무 많은 실패로 인해 5분 동안 차단되었습니다.')

        try:
            data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            cache.set(cache_key, attempts + 1, 300)
            return StatusError(ErrorCode.VALIDATE, 'Invalid JSON format')

        code = data.get('code', '')
        username = data.get('username', '')

        try:
            if not username:
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.VALIDATE, '사용자 이름이 필요합니다.')

            if not code or len(code) < 6:
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.VALIDATE, '인증 코드를 입력해주세요.')

            try:
                user = User.objects.get(username=username)
                TwoFactorAuth.objects.get(user=user)
            except User.DoesNotExist:
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.REJECT)
            except TwoFactorAuth.DoesNotExist:
                cache.set(cache_key, attempts + 1, 300)
                return StatusError(ErrorCode.REJECT)

            if AuthService.verify_totp_token(user, code):
                cache.delete(cache_key)
                auth.login(request, user)
                return login_response(request.user)
            else:
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
