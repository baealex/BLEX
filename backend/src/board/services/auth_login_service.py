import ipaddress
from dataclasses import dataclass
from time import time

from django.conf import settings
from django.contrib import auth
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import F
from django.http import HttpRequest
from django.utils.crypto import salted_hmac
from django.utils.translation import gettext

from board.models import LoginAttempt
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_service import AuthService, OAuthService


class LoginRateLimitReached(Exception):
    pass


@dataclass(frozen=True)
class LoginAttemptReservation:
    keys: tuple[str, ...]

    def release(self) -> None:
        LoginAttempt.objects.filter(key__in=self.keys, count__gt=0).update(count=F('count') - 1)


class AuthLoginService:
    """Coordinate login, rate limit, and login-time 2FA flows."""

    LOGIN_ATTEMPT_LIMIT = 5
    ACCOUNT_ATTEMPT_LIMIT = 10
    LOGIN_ATTEMPT_TTL_SECONDS = 300

    @staticmethod
    def login_response(user: User, is_first_login=False):
        data = AuthService.get_user_login_data(user)
        data['is_first_login'] = is_first_login
        return StatusDone(data)

    @staticmethod
    def get_client_ip(request) -> str:
        remote_addr = request.META.get('REMOTE_ADDR', '')
        trusted_proxy_ips = {
            AuthLoginService._normalize_ip(address)
            for address in getattr(settings, 'TRUSTED_PROXY_IPS', [])
        }
        trusted_proxy_ips.discard(None)

        if AuthLoginService._normalize_ip(remote_addr) not in trusted_proxy_ips:
            return AuthLoginService._normalize_ip(remote_addr) or 'unknown'

        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        for address in reversed(forwarded_for.split(',')):
            normalized_address = AuthLoginService._normalize_ip(address)
            if normalized_address and normalized_address not in trusted_proxy_ips:
                return normalized_address

        return AuthLoginService._normalize_ip(remote_addr) or 'unknown'

    @staticmethod
    def _normalize_ip(address: str):
        try:
            return ipaddress.ip_address(address.strip()).compressed
        except (ValueError, AttributeError):
            return None

    @classmethod
    def reserve_login_attempt(cls, request: HttpRequest, username: str) -> LoginAttemptReservation | None:
        window = int(time()) // cls.LOGIN_ATTEMPT_TTL_SECONDS
        limits = (
            ('ip', cls.get_client_ip(request), cls.LOGIN_ATTEMPT_LIMIT),
            ('account', User.normalize_username(username).casefold(), cls.ACCOUNT_ATTEMPT_LIMIT),
        )
        keys = []
        try:
            with transaction.atomic():
                LoginAttempt.objects.filter(window__lt=window - 1).delete()
                for scope, value, limit in limits:
                    key = salted_hmac(
                        'blex.login-attempt', f'{window}:{scope}:{value}', algorithm='sha256',
                    ).hexdigest()
                    LoginAttempt.objects.bulk_create(
                        [LoginAttempt(key=key, window=window)], ignore_conflicts=True,
                    )
                    updated = LoginAttempt.objects.filter(key=key, count__lt=limit).update(count=F('count') + 1)
                    if not updated:
                        raise LoginRateLimitReached
                    keys.append(key)
        except LoginRateLimitReached:
            return None
        return LoginAttemptReservation(tuple(keys))

    @staticmethod
    def rate_limit_error():
        return StatusError(
            ErrorCode.REJECT, gettext('Too many failed attempts. Please try again later.'),
        )

    @classmethod
    def handle_oauth_token_login(cls, request: HttpRequest, data: dict):
        two_factor_code = data.get('code', '') or request.POST.get('code', '')
        oauth_data = OAuthService.get_2fa_data(request.session)
        user = User.objects.filter(pk=oauth_data['user_id'], is_active=True).first() if oauth_data else None
        if user is None:
            return StatusError(
                ErrorCode.REJECT,
                gettext('The authentication token has expired. Please log in again.'),
            )
        if not isinstance(two_factor_code, str) or not two_factor_code:
            return StatusError(
                ErrorCode.VALIDATE, gettext('A two-factor authentication code is required.'),
            )

        attempt = cls.reserve_login_attempt(request, user.username)
        if attempt is None:
            return cls.rate_limit_error()
        if not AuthService.verify_totp_token(user, two_factor_code):
            return cls.invalid_two_factor_code()

        attempt.release()
        OAuthService.clear_2fa_data(request.session)
        auth.login(request, user)
        return cls.login_response(request.user)

    @staticmethod
    def invalid_two_factor_code():
        return StatusError(
            ErrorCode.REJECT, gettext('The two-factor authentication code is incorrect.'),
        )

    @classmethod
    def handle_password_login(cls, request: HttpRequest, data: dict):
        username = data.get('username', '') or request.POST.get('username', '')
        password = data.get('password', '') or request.POST.get('password', '')
        two_factor_code = data.get('code', '') or request.POST.get('code', '')
        if not all(isinstance(value, str) for value in (username, password, two_factor_code)):
            return StatusError(ErrorCode.AUTHENTICATION)

        attempt = cls.reserve_login_attempt(request, username)
        if attempt is None:
            return cls.rate_limit_error()
        user = auth.authenticate(request, username=username, password=password)
        if user is None:
            return StatusError(ErrorCode.AUTHENTICATION)

        if AuthService.check_two_factor_auth(user):
            if not two_factor_code:
                attempt.release()
                return StatusDone({'username': user.username, 'security': True, 'is_oauth': False})
            if not AuthService.verify_totp_token(user, two_factor_code):
                return cls.invalid_two_factor_code()

        attempt.release()
        OAuthService.clear_2fa_data(request.session)
        auth.login(request, user)
        return cls.login_response(request.user)
