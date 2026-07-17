import hashlib
import secrets
from datetime import timedelta

from django.core import signing
from django.utils import timezone

from board.models import UtilityCleanupConfirmation


class InvalidUtilityCleanupConfirmationError(Exception):
    """Raised when a destructive utility request lacks its matching preview."""


class UtilityCleanupConfirmationService:
    """Issue short-lived, user-and-session-bound cleanup confirmations."""

    SALT = 'board.utility-cleanup-confirmation'
    MAX_AGE_SECONDS = 300

    @staticmethod
    def session_fingerprint(session_key: str) -> str:
        """Bind the token to a session without exposing its cookie value to JS."""
        return hashlib.sha256(session_key.encode('utf-8')).hexdigest()

    @classmethod
    def issue(
        cls,
        *,
        user_id: int,
        session_key: str,
        action: str,
        parameters: dict,
    ) -> str:
        now = timezone.now()
        session_fingerprint = cls.session_fingerprint(session_key)
        token = signing.dumps(
            {
                'user_id': user_id,
                'session_fingerprint': session_fingerprint,
                'action': action,
                'parameters': parameters,
                'nonce': secrets.token_urlsafe(16),
            },
            salt=cls.SALT,
        )
        UtilityCleanupConfirmation.objects.filter(expires_at__lte=now).delete()
        UtilityCleanupConfirmation.objects.create(
            user_id=user_id,
            token_hash=cls.token_hash(token),
            action=action,
            session_fingerprint=session_fingerprint,
            expires_at=now + timedelta(seconds=cls.MAX_AGE_SECONDS),
        )
        return token

    @staticmethod
    def token_hash(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @classmethod
    def require_valid(
        cls,
        *,
        token: object,
        user_id: int,
        session_key: str,
        action: str,
        parameters: dict,
    ) -> str:
        if not isinstance(token, str) or not token:
            raise InvalidUtilityCleanupConfirmationError

        try:
            payload = signing.loads(
                token,
                salt=cls.SALT,
                max_age=cls.MAX_AGE_SECONDS,
            )
        except (signing.BadSignature, signing.SignatureExpired) as error:
            raise InvalidUtilityCleanupConfirmationError from error

        nonce = payload.get('nonce') if isinstance(payload, dict) else None
        if not isinstance(nonce, str) or not nonce:
            raise InvalidUtilityCleanupConfirmationError

        expected_payload = {
            'user_id': user_id,
            'session_fingerprint': cls.session_fingerprint(session_key),
            'action': action,
            'parameters': parameters,
            'nonce': nonce,
        }
        if payload != expected_payload:
            raise InvalidUtilityCleanupConfirmationError

        return cls.token_hash(token)

    @classmethod
    def consume(
        cls,
        *,
        token_hash: str,
        user_id: int,
        session_key: str,
        action: str,
    ) -> None:
        now = timezone.now()
        confirmation = UtilityCleanupConfirmation.objects.select_for_update().filter(
            token_hash=token_hash,
            user_id=user_id,
            action=action,
            session_fingerprint=cls.session_fingerprint(session_key),
            expires_at__gt=now,
            consumed_at__isnull=True,
        ).first()
        if confirmation is None:
            raise InvalidUtilityCleanupConfirmationError

        confirmation.consumed_at = now
        confirmation.save(update_fields=['consumed_at'])
