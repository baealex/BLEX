import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone

from board.models import DeveloperRequestLog, DeveloperToken


class DeveloperAuthError(Exception):
    def __init__(self, code, message, status_code=400):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DeveloperTokenService:
    TOKEN_PREFIX = 'blex_pat'
    DEFAULT_EXPIRES_DAYS = 90
    MAX_EXPIRES_DAYS = 365
    VALID_SCOPES = {'posts:read', 'posts:write'}
    WRITE_SCOPES = {'posts:write'}

    @staticmethod
    def hash_token(token):
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def client_ip(request):
        forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def normalize_scopes(scopes):
        if scopes is None:
            return ['posts:read']
        if isinstance(scopes, str):
            scopes = [scope.strip() for scope in scopes.split(',')]
        scopes = sorted(set(scope for scope in scopes if scope))

        invalid_scopes = set(scopes) - DeveloperTokenService.VALID_SCOPES
        if invalid_scopes:
            raise DeveloperAuthError(
                'token.invalid_scope',
                f'지원하지 않는 scope입니다: {", ".join(sorted(invalid_scopes))}',
                400,
            )

        if not scopes:
            raise DeveloperAuthError(
                'token.invalid_scope',
                '최소 하나의 scope가 필요합니다.',
                400,
            )

        return scopes

    @staticmethod
    def validate_user_can_create_token(user, scopes):
        if not user.is_authenticated or not user.is_active:
            raise DeveloperAuthError('auth.need_login', '로그인이 필요합니다.', 401)

        if DeveloperTokenService.WRITE_SCOPES.intersection(scopes):
            if not hasattr(user, 'profile') or not user.profile.is_editor():
                raise DeveloperAuthError(
                    'token.permission_denied',
                    '글 작성 scope는 편집자 권한이 필요합니다.',
                    403,
                )

    @staticmethod
    def normalize_expires_at(expires_in_days):
        if expires_in_days in (None, ''):
            expires_in_days = DeveloperTokenService.DEFAULT_EXPIRES_DAYS

        try:
            expires_in_days = int(expires_in_days)
        except (TypeError, ValueError):
            raise DeveloperAuthError(
                'token.invalid_expiry',
                'expires_in_days는 숫자여야 합니다.',
                400,
            )

        if expires_in_days <= 0 or expires_in_days > DeveloperTokenService.MAX_EXPIRES_DAYS:
            raise DeveloperAuthError(
                'token.invalid_expiry',
                f'expires_in_days는 1에서 {DeveloperTokenService.MAX_EXPIRES_DAYS} 사이여야 합니다.',
                400,
            )

        return timezone.now() + timedelta(days=expires_in_days)

    @staticmethod
    def build_raw_token(token_prefix):
        secret = secrets.token_urlsafe(32)
        return f'{DeveloperTokenService.TOKEN_PREFIX}_{token_prefix}_{secret}'

    @staticmethod
    def create_unique_prefix():
        for _ in range(5):
            token_prefix = secrets.token_hex(6)
            if not DeveloperToken.objects.filter(token_prefix=token_prefix).exists():
                return token_prefix

        raise DeveloperAuthError(
            'token.prefix_collision',
            '토큰 prefix 생성에 실패했습니다. 다시 시도해주세요.',
            500,
        )

    @staticmethod
    def create_token(user: User, name='', scopes=None, expires_in_days=None):
        normalized_scopes = DeveloperTokenService.normalize_scopes(scopes)
        DeveloperTokenService.validate_user_can_create_token(user, normalized_scopes)

        token_prefix = DeveloperTokenService.create_unique_prefix()
        raw_token = DeveloperTokenService.build_raw_token(token_prefix)
        token = DeveloperToken.objects.create(
            user=user,
            name=(name or 'Developer token')[:100],
            token_prefix=token_prefix,
            token_hash=DeveloperTokenService.hash_token(raw_token),
            scopes=normalized_scopes,
            expires_at=DeveloperTokenService.normalize_expires_at(expires_in_days),
        )
        return raw_token, token

    @staticmethod
    def parse_bearer_token(request):
        authorization = request.META.get('HTTP_AUTHORIZATION', '')
        scheme, _, raw_token = authorization.partition(' ')

        if scheme.lower() != 'bearer' or not raw_token:
            raise DeveloperAuthError(
                'auth.missing_token',
                'Bearer 토큰이 필요합니다.',
                401,
            )

        return raw_token.strip()

    @staticmethod
    def parse_token_prefix(raw_token):
        token_start = f'{DeveloperTokenService.TOKEN_PREFIX}_'
        if not raw_token.startswith(token_start):
            raise DeveloperAuthError(
                'auth.invalid_token',
                '유효하지 않은 토큰입니다.',
                401,
            )

        rest = raw_token[len(token_start):]
        token_prefix, _, secret = rest.partition('_')
        if not token_prefix or not secret:
            raise DeveloperAuthError(
                'auth.invalid_token',
                '유효하지 않은 토큰입니다.',
                401,
            )

        return token_prefix

    @staticmethod
    def authenticate_request(request):
        raw_token = DeveloperTokenService.parse_bearer_token(request)
        token_prefix = DeveloperTokenService.parse_token_prefix(raw_token)
        token_hash = DeveloperTokenService.hash_token(raw_token)

        try:
            token = DeveloperToken.objects.select_related(
                'user',
                'user__profile',
            ).get(token_prefix=token_prefix)
        except DeveloperToken.DoesNotExist:
            raise DeveloperAuthError(
                'auth.invalid_token',
                '유효하지 않은 토큰입니다.',
                401,
            )

        if not secrets.compare_digest(token.token_hash, token_hash):
            raise DeveloperAuthError(
                'auth.invalid_token',
                '유효하지 않은 토큰입니다.',
                401,
            )

        if not token.is_valid():
            raise DeveloperAuthError(
                'auth.invalid_token',
                '만료되었거나 폐기된 토큰입니다.',
                401,
            )

        if not token.user.is_active:
            raise DeveloperAuthError(
                'auth.inactive_user',
                '비활성 사용자입니다.',
                401,
            )

        DeveloperToken.objects.filter(id=token.id).update(
            last_used_at=timezone.now(),
            last_used_ip=DeveloperTokenService.client_ip(request),
            updated_date=timezone.now(),
        )

        return token

    @staticmethod
    def require_scope(token, scope):
        if not token.has_scope(scope):
            raise DeveloperAuthError(
                'auth.insufficient_scope',
                f'{scope} scope가 필요합니다.',
                403,
            )

    @staticmethod
    def revoke_token(token):
        token.revoked_at = timezone.now()
        token.updated_date = timezone.now()
        token.save(update_fields=['revoked_at', 'updated_date'])
        return token

    @staticmethod
    def record_request(request, token, status_code):
        DeveloperRequestLog.objects.create(
            user=token.user,
            token=token,
            method=request.method,
            path=request.path[:255],
            status_code=status_code,
            ip_address=DeveloperTokenService.client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255],
        )
