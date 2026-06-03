import datetime
import traceback
import io
import pyotp
import qrcode
import base64

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.models import User
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import (
    TwoFactorAuth, Config, Profile, Post,
    UserLinkMeta, UsernameChangeLog, TelegramSync, SocialAuthProvider, SiteSetting)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_login_service import AuthLoginService
from board.services.auth_request_parser import AuthRequestParser
from board.services.author_invite_service import AuthorInviteError, AuthorInviteService
from board.services.auth_service import AuthService, OAuthService, AuthValidationError
from board.services.initial_setup_service import InitialSetupService
from board.services.api_request_body_service import ApiRequestBodyService
from modules import oauth
from modules.challenge import auth_hcaptcha
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot
from modules.randomness import randnum, randstr


def login(request):
    if request.method == 'GET':
        if request.user.is_active:
            return AuthLoginService.login_response(request.user)
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        rate_limit_error = AuthLoginService.check_login_rate_limit(request)
        if rate_limit_error:
            return rate_limit_error

        data = AuthRequestParser.parse_login_request(request)

        oauth_token = data.get('oauth_token', '') or request.POST.get('oauth_token', '')
        if oauth_token:
            return AuthLoginService.handle_oauth_token_login(request, data)
        else:
            return AuthLoginService.handle_password_login(request, data)

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
        if InitialSetupService.should_prompt_for_initial_setup():
            return StatusError(
                ErrorCode.REJECT,
                '첫 관리자 계정을 먼저 만들어주세요.'
            )

        username = request.POST.get('username', '')
        name = request.POST.get('name', '')
        password = request.POST.get('password', '')
        email = request.POST.get('email', '')
        invite_code = request.POST.get('invite_code', '')
        hcaptcha_response = request.POST.get('h-captcha-response', '')

        try:
            AuthService.validate_username(username)
            AuthService.validate_email(email)
        except AuthValidationError as e:
            return StatusError(e.code, e.message)

        try:
            author_invite = AuthorInviteService.validate_invite_code(invite_code)
        except AuthorInviteError as e:
            return StatusError(ErrorCode.REJECT, e.message)

        # Verify HCaptcha if HCAPTCHA_SECRET_KEY is set
        if settings.HCAPTCHA_SECRET_KEY:
            if not hcaptcha_response:
                return StatusError(ErrorCode.VALIDATE, '보안 검증이 필요합니다.')
            if not auth_hcaptcha(hcaptcha_response):
                return StatusError(ErrorCode.REJECT, '보안 검증에 실패했습니다.')

        try:
            with transaction.atomic():
                new_user, _, _ = AuthService.create_user(
                    username=username,
                    name=name,
                    email=email,
                    password=password
                )
                AuthorInviteService.redeem_invite(author_invite, new_user)
        except AuthorInviteError as e:
            return StatusError(ErrorCode.REJECT, e.message)

        auth.login(request, new_user)
        return AuthLoginService.login_response(request.user, is_first_login=True)

    if request.method == 'PATCH':
        user = request.user
        body = ApiRequestBodyService.parse_json_or_querydict(request)

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
        if InitialSetupService.should_prompt_for_initial_setup():
            return StatusError(
                ErrorCode.REJECT,
                '첫 관리자 계정을 먼저 만들어주세요.'
            )

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
                    return AuthLoginService.common_auth(request, users.first(), is_oauth=True)

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
                return AuthLoginService.login_response(request.user, is_first_login=True)

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
                    return AuthLoginService.common_auth(request, users.first(), is_oauth=True)

                user, profile, config = AuthService.create_user(
                    username=user_id,
                    name=name,
                    email=email,
                    avatar_url=avatar_url,
                    token=token,
                )

                auth.login(request, user)
                return AuthLoginService.login_response(request.user, is_first_login=True)

    raise Http404


def security(request):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
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
            if hasattr(request.user, 'twofactorauth'):
                return StatusError(ErrorCode.ALREADY_CONNECTED)

            totp_secret = AuthService.create_totp_secret()
            recovery_key = randstr(45)

            request.session['totp_setup'] = {
                'secret': totp_secret,
                'recovery_key': recovery_key,
                'user_id': request.user.id
            }

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
            return StatusError(ErrorCode.REJECT, f'2FA 설정 초기화에 실패했습니다: {str(e)}')

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
            setup_data = request.session.get('totp_setup')
            if not setup_data:
                return StatusError(ErrorCode.EXPIRED, '2FA 설정 세션이 만료되었습니다. 다시 시도해주세요.')

            if setup_data['user_id'] != request.user.id:
                return StatusError(ErrorCode.AUTHENTICATION, '잘못된 세션입니다.')

            if hasattr(request.user, 'twofactorauth'):
                del request.session['totp_setup']
                return StatusError(ErrorCode.ALREADY_CONNECTED)

            data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
            code = data.get('code', '').strip()

            if not code:
                return StatusError(ErrorCode.INVALID_PARAMETER, '인증 코드를 입력해주세요.')

            totp = pyotp.TOTP(setup_data['secret'])
            if not totp.verify(code, valid_window=1):
                return StatusError(ErrorCode.REJECT, '잘못된 인증 코드입니다.')

            two_factor_auth = TwoFactorAuth(user=request.user)
            two_factor_auth.totp_secret = setup_data['secret']
            two_factor_auth.recovery_key = setup_data['recovery_key']
            two_factor_auth.save()

            del request.session['totp_setup']

            return StatusDone({'message': '2차 인증이 활성화되었습니다.'})

        except Exception as e:
            traceback.print_exc()
            return StatusError(ErrorCode.REJECT, f'2FA 활성화에 실패했습니다: {str(e)}')

    raise Http404


def social_providers(request):
    """
    Get available social authentication providers
    """
    if request.method == 'GET':
        providers = SocialAuthProvider.objects.all().values('key', 'name', 'icon', 'color')
        return StatusDone(list(providers))
    raise Http404
