import datetime

from django.contrib import auth
from django.contrib.auth.models import User
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext

from board.models import (
    Config, Profile, Post,
    UsernameChangeLog, TelegramSync)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_login_service import AuthLoginService
from board.services.auth_request_parser import AuthRequestParser
from board.services.author_invite_service import AuthorInviteError, AuthorInviteService
from board.services.auth_service import AuthService, OAuthService, AuthValidationError
from board.services.initial_setup_service import InitialSetupService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.hcaptcha_service import HCaptchaService
from board.services.social_auth_provider_service import SocialAuthProviderService
from board.services.social_signup_service import (
    SocialSignupError,
    SocialSignupErrorKind,
    SocialSignupService,
)
from board.services.two_factor_setup_service import (
    TwoFactorSetupError,
    TwoFactorSetupService,
)
from modules.challenge import auth_hcaptcha
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot


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
                gettext('Create the first administrator account before continuing.'),
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

        if HCaptchaService.is_enabled():
            if not hcaptcha_response:
                return StatusError(
                    ErrorCode.VALIDATE,
                    gettext('Security verification is required.'),
                )
            if not auth_hcaptcha(hcaptcha_response):
                return StatusError(
                    ErrorCode.REJECT,
                    gettext('Security verification failed.'),
                )

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
                return StatusError(
                    ErrorCode.REJECT,
                    gettext('You can change your username only once every six months.'),
                )

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
        try:
            result = SocialSignupService.sign_up(
                provider_key=social,
                code=request.POST.get('code'),
            )
        except SocialSignupError as error:
            if error.kind == SocialSignupErrorKind.INITIAL_SETUP_REQUIRED:
                return StatusError(
                    ErrorCode.REJECT,
                    gettext('Create the first administrator account before continuing.'),
                )
            if error.kind in {
                SocialSignupErrorKind.UNSUPPORTED_PROVIDER,
                SocialSignupErrorKind.MISSING_CODE,
            }:
                raise Http404
            if error.kind == SocialSignupErrorKind.PROVIDER_DISABLED:
                return StatusError(
                    ErrorCode.REJECT,
                    gettext('Social login is not configured.'),
                )
            return StatusError(
                ErrorCode.REJECT,
            )

        if not result.is_first_login:
            return AuthLoginService.common_auth(request, result.user, is_oauth=True)

        auth.login(request, result.user)
        return AuthLoginService.login_response(request.user, is_first_login=True)

    raise Http404


def security(request):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
        try:
            result = TwoFactorSetupService.get_security(request.user)
        except TwoFactorSetupError as error:
            return StatusError(error.code, error.message)
        return StatusDone({
            'qr_code': result.qr_code,
            'has_recovery_key': result.has_recovery_key,
        })

    if request.method == 'POST':
        try:
            result = TwoFactorSetupService.initialize(
                request.user,
                request.session,
            )
        except TwoFactorSetupError as error:
            return StatusError(error.code, error.message)
        return StatusDone({
            'qr_code': result.qr_code,
            'recovery_key': result.recovery_key,
        })

    if request.method == 'DELETE':
        try:
            TwoFactorSetupService.disable(request.user)
        except TwoFactorSetupError as error:
            return StatusError(error.code, error.message)
        return StatusDone()

    raise Http404


def security_verify(request):
    """Verify TOTP code and complete 2FA setup"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'POST':
        data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
        try:
            TwoFactorSetupService.activate(
                request.user,
                request.session,
                data.get('code', ''),
            )
        except TwoFactorSetupError as error:
            return StatusError(error.code, error.message)
        return StatusDone({
            'message': gettext('Two-factor authentication has been enabled.'),
        })

    raise Http404


def social_providers(request):
    """
    Get available social authentication providers
    """
    if request.method == 'GET':
        return StatusDone(SocialAuthProviderService.serialize_public_providers())
    raise Http404
