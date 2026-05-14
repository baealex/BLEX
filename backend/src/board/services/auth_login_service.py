from django.contrib import auth
from django.contrib.auth.models import User
from django.core.cache import cache

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.auth_service import AuthService, OAuthService


class AuthLoginService:
    """Coordinate login, rate limit, and login-time 2FA flows."""

    LOGIN_ATTEMPT_LIMIT = 5
    LOGIN_ATTEMPT_TTL_SECONDS = 300

    @staticmethod
    def login_response(user: User, is_first_login=False):
        data = AuthService.get_user_login_data(user)
        data['is_first_login'] = is_first_login
        return StatusDone(data)

    @staticmethod
    def get_client_ip(request) -> str:
        return request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))

    @staticmethod
    def get_attempt_cache_key(request) -> str:
        return f'login_attempts:{AuthLoginService.get_client_ip(request)}'

    @staticmethod
    def check_login_rate_limit(request):
        attempts = cache.get(AuthLoginService.get_attempt_cache_key(request), 0)

        if attempts >= AuthLoginService.LOGIN_ATTEMPT_LIMIT:
            return StatusError(ErrorCode.REJECT, '너무 많은 실패로 인해 잠시 후 다시 시도해주세요.')

        return None

    @staticmethod
    def clear_login_attempts(request) -> None:
        cache.delete(AuthLoginService.get_attempt_cache_key(request))

    @staticmethod
    def increment_login_attempts(request) -> None:
        cache_key = AuthLoginService.get_attempt_cache_key(request)
        cache.set(
            cache_key,
            cache.get(cache_key, 0) + 1,
            AuthLoginService.LOGIN_ATTEMPT_TTL_SECONDS,
        )

    @staticmethod
    def common_auth(request, user: User, two_factor_code=None, is_oauth=False):
        if AuthService.check_two_factor_auth(user):
            if two_factor_code:
                if AuthService.verify_totp_token(user, two_factor_code):
                    AuthLoginService.clear_login_attempts(request)
                    auth.login(request, user)
                    return AuthLoginService.login_response(request.user)

                AuthLoginService.increment_login_attempts(request)
                return StatusError(ErrorCode.REJECT, '2차 인증 코드가 올바르지 않습니다.')

            return StatusDone({
                'username': user.username,
                'security': True,
                'is_oauth': is_oauth,
            })

        auth.login(request, user)
        return AuthLoginService.login_response(request.user)

    @staticmethod
    def handle_oauth_token_login(request, data):
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

        if AuthService.verify_totp_token(user, two_factor_code):
            AuthLoginService.clear_login_attempts(request)
            OAuthService.delete_2fa_token(oauth_token)
            auth.login(request, user)
            return AuthLoginService.login_response(request.user)

        AuthLoginService.increment_login_attempts(request)
        return StatusError(ErrorCode.REJECT, '2차 인증 코드가 올바르지 않습니다.')

    @staticmethod
    def handle_password_login(request, data):
        username = data.get('username', '') or request.POST.get('username', '')
        password = data.get('password', '') or request.POST.get('password', '')
        two_factor_code = data.get('code', '') or request.POST.get('code', '')

        user = auth.authenticate(username=username, password=password)

        if user is not None:
            if user.is_active:
                AuthLoginService.clear_login_attempts(request)
                return AuthLoginService.common_auth(
                    request,
                    user,
                    two_factor_code=two_factor_code,
                )
        else:
            AuthLoginService.increment_login_attempts(request)
            return StatusError(ErrorCode.AUTHENTICATION)

        return None
