import hashlib
import secrets
from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from django.utils.translation import gettext

from board.models import DeveloperRequestLog, DeveloperToken
from board.services.authoring_permission_service import AuthoringPermissionService


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
                gettext('Unsupported scopes: %(scopes)s') % {
                    'scopes': ', '.join(sorted(invalid_scopes)),
                },
                400,
            )

        if not scopes:
            raise DeveloperAuthError(
                'token.invalid_scope',
                gettext('At least one scope is required.'),
                400,
            )

        return scopes

    @staticmethod
    def validate_user_can_create_token(user, scopes):
        if not user.is_authenticated or not user.is_active:
            raise DeveloperAuthError('auth.need_login', gettext('Login required.'), 401)

        if not AuthoringPermissionService.is_active_editor(user):
            raise DeveloperAuthError(
                'token.permission_denied',
                gettext('The Developer API requires author access.'),
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
                gettext('expires_in_days must be a number.'),
                400,
            )

        if expires_in_days <= 0 or expires_in_days > DeveloperTokenService.MAX_EXPIRES_DAYS:
            raise DeveloperAuthError(
                'token.invalid_expiry',
                gettext('expires_in_days must be between 1 and %(max_days)s.') % {
                    'max_days': DeveloperTokenService.MAX_EXPIRES_DAYS,
                },
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
            gettext('Could not generate a token prefix. Try again.'),
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
                gettext('A Bearer token is required.'),
                401,
            )

        return raw_token.strip()

    @staticmethod
    def parse_token_prefix(raw_token):
        token_start = f'{DeveloperTokenService.TOKEN_PREFIX}_'
        if not raw_token.startswith(token_start):
            raise DeveloperAuthError(
                'auth.invalid_token',
                gettext('Invalid token.'),
                401,
            )

        rest = raw_token[len(token_start):]
        token_prefix, _, secret = rest.partition('_')
        if not token_prefix or not secret:
            raise DeveloperAuthError(
                'auth.invalid_token',
                gettext('Invalid token.'),
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
                gettext('Invalid token.'),
                401,
            )

        if not secrets.compare_digest(token.token_hash, token_hash):
            raise DeveloperAuthError(
                'auth.invalid_token',
                gettext('Invalid token.'),
                401,
            )

        if not token.is_valid():
            raise DeveloperAuthError(
                'auth.invalid_token',
                gettext('This token has expired or been revoked.'),
                401,
            )

        if not token.user.is_active:
            raise DeveloperAuthError(
                'auth.inactive_user',
                gettext('This user is inactive.'),
                401,
            )

        if not AuthoringPermissionService.is_active_editor(token.user):
            raise DeveloperAuthError(
                'auth.editor_required',
                gettext('The Developer API requires author access.'),
                403,
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
                gettext('%(scope)s scope is required.') % {'scope': scope},
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
