from time import time

from django.contrib.auth.hashers import check_password
from django.http import HttpRequest, JsonResponse
from django.utils.translation import gettext

from board.models import TwoFactorAuth
from board.modules.response import ErrorCode, StatusError
from board.services.auth_login_service import AuthLoginService
from board.services.auth_service import AuthService


class AccountReauthenticationService:
    SESSION_KEY = 'account_reauthentication'
    PENDING_SOCIAL_KEY = 'account_reauthentication_social'
    VALIDITY_SECONDS = 300
    ERROR_KEY = 'auth.reauthentication_required'

    @classmethod
    def credential_state(cls, request: HttpRequest) -> dict:
        return {
            'user_id': request.user.pk,
            'auth_hash': request.user.get_session_auth_hash(),
            'two_factor_id': TwoFactorAuth.objects.filter(user=request.user).values_list('pk', flat=True).first(),
        }

    @classmethod
    def has_recent_verification(cls, request: HttpRequest, key: str) -> bool:
        proof = request.session.get(key)
        return bool(
            request.user.is_authenticated
            and proof
            and proof['expires_at'] > time()
            and proof['credentials'] == cls.credential_state(request)
        )

    @classmethod
    def require(cls, request: HttpRequest) -> JsonResponse | None:
        if cls.has_recent_verification(request, cls.SESSION_KEY):
            return None
        return StatusError(
            ErrorCode.REQUIRE, gettext('Verify your identity to continue.'), message_key=cls.ERROR_KEY,
        )

    @classmethod
    def record(cls, request: HttpRequest, key: str) -> None:
        request.session.cycle_key()
        request.session[key] = {
            'credentials': cls.credential_state(request),
            'expires_at': time() + cls.VALIDITY_SECONDS,
        }

    @classmethod
    def verify(cls, request: HttpRequest, password: str, code: str) -> str:
        user = request.user
        attempt = AuthLoginService.reserve_login_attempt(request, user.username)
        if attempt is None:
            return gettext('Too many failed attempts. Please try again later.')

        authenticated = cls.has_recent_verification(request, cls.PENDING_SOCIAL_KEY) or (
            user.has_usable_password() and check_password(password, user.password)
        )
        if not authenticated or (
            AuthService.check_two_factor_auth(user) and not AuthService.verify_totp_token(user, code)
        ):
            return gettext('The password or verification code is incorrect.')

        attempt.release()
        request.session.pop(cls.PENDING_SOCIAL_KEY, None)
        cls.record(request, cls.SESSION_KEY)
        return ''
