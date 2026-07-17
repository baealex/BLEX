"""Typed 2FA setup, activation, inspection, and disable use cases."""

from __future__ import annotations

import base64
import io
import secrets

from dataclasses import dataclass
from typing import ClassVar, Mapping, MutableMapping, TypedDict, cast

import pyotp
import qrcode

from django.contrib.auth.models import User
from django.db import transaction

from board.models import TwoFactorAuth
from board.modules.response import ErrorCode


class TwoFactorSetupSession(TypedDict):
    secret: str
    recovery_key: str
    user_id: int


class TwoFactorSetupError(Exception):
    """A typed failure that the API view converts to its legacy envelope."""

    def __init__(self, code: ErrorCode, message: str = ''):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class TwoFactorSetupResult:
    qr_code: str
    recovery_key: str


@dataclass(frozen=True)
class TwoFactorSecurityResult:
    qr_code: str
    has_recovery_key: bool


class TwoFactorSetupService:
    """Coordinate 2FA setup state without depending on HTTP request objects."""

    SESSION_KEY: ClassVar[str] = 'totp_setup'
    RECOVERY_KEY_ALPHABET: ClassVar[str] = (
        '0123456789abcdefghijklnmopqrstuvwxyzABCDEFGHIJKLNMOPQRSTUVWXYZ'
    )

    @staticmethod
    def create_totp_secret() -> str:
        return pyotp.random_base32()

    @classmethod
    def create_recovery_key(cls, alphabet: str | None = None) -> str:
        selected_alphabet = alphabet if alphabet is not None else cls.RECOVERY_KEY_ALPHABET
        return ''.join(
            secrets.choice(selected_alphabet)
            for _ in range(45)
        )

    @staticmethod
    def generate_qr_code(provisioning_uri: str) -> str:
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        image = qr.make_image(fill_color='black', back_color='white')
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        encoded_image = base64.b64encode(buffer.getvalue()).decode()
        return f'data:image/png;base64,{encoded_image}'

    @classmethod
    def get_totp_qr_code(cls, user: User) -> str | None:
        try:
            two_factor_auth = TwoFactorAuth.objects.get(user=user)
        except TwoFactorAuth.DoesNotExist:
            return None

        provisioning_uri = two_factor_auth.get_provisioning_uri()
        if not provisioning_uri:
            return None
        return cls.generate_qr_code(provisioning_uri)

    @classmethod
    def get_security(cls, user: User) -> TwoFactorSecurityResult:
        if not hasattr(user, 'twofactorauth'):
            raise TwoFactorSetupError(ErrorCode.NOT_FOUND)

        two_factor_auth = user.twofactorauth
        qr_code = cls.get_totp_qr_code(user)
        if not qr_code:
            raise TwoFactorSetupError(ErrorCode.NOT_FOUND)

        return TwoFactorSecurityResult(
            qr_code=qr_code,
            has_recovery_key=bool(two_factor_auth.recovery_key),
        )

    @classmethod
    def initialize(
        cls,
        user: User,
        session: MutableMapping[str, object],
    ) -> TwoFactorSetupResult:
        try:
            if hasattr(user, 'twofactorauth'):
                raise TwoFactorSetupError(ErrorCode.ALREADY_CONNECTED)

            secret = cls.create_totp_secret()
            recovery_key = cls.create_recovery_key()
            setup_session = TwoFactorSetupSession(
                secret=secret,
                recovery_key=recovery_key,
                user_id=user.id,
            )
            session[cls.SESSION_KEY] = setup_session

            provisioning_uri = pyotp.TOTP(secret).provisioning_uri(
                name=user.email,
                issuer_name='BLEX',
            )
            return TwoFactorSetupResult(
                qr_code=cls.generate_qr_code(provisioning_uri),
                recovery_key=recovery_key,
            )
        except TwoFactorSetupError:
            raise
        except Exception as error:
            raise TwoFactorSetupError(
                ErrorCode.REJECT,
                f'2FA 설정 초기화에 실패했습니다: {str(error)}',
            ) from error

    @staticmethod
    def disable(user: User) -> None:
        try:
            two_factor_auth = TwoFactorAuth.objects.only(
                'id',
                'user_id',
                'created_date',
            ).get(user=user)
        except TwoFactorAuth.DoesNotExist:
            raise TwoFactorSetupError(ErrorCode.ALREADY_DISCONNECTED)

        if not two_factor_auth.has_been_a_day():
            raise TwoFactorSetupError(
                ErrorCode.REJECT,
                '24시간 동안 해제할 수 없습니다.',
            )

        two_factor_auth.delete()

    @classmethod
    @transaction.atomic
    def activate(
        cls,
        user: User,
        session: MutableMapping[str, object],
        code: object,
    ) -> None:
        try:
            raw_setup_data = session.get(cls.SESSION_KEY)
            if not raw_setup_data:
                raise TwoFactorSetupError(
                    ErrorCode.EXPIRED,
                    '2FA 설정 세션이 만료되었습니다. 다시 시도해주세요.',
                )

            setup_data = cast(Mapping[str, object], raw_setup_data)
            if setup_data['user_id'] != user.id:
                raise TwoFactorSetupError(
                    ErrorCode.AUTHENTICATION,
                    '잘못된 세션입니다.',
                )

            if hasattr(user, 'twofactorauth'):
                del session[cls.SESSION_KEY]
                raise TwoFactorSetupError(ErrorCode.ALREADY_CONNECTED)

            normalized_code = cast(str, code).strip()
            if not normalized_code:
                raise TwoFactorSetupError(
                    ErrorCode.INVALID_PARAMETER,
                    '인증 코드를 입력해주세요.',
                )

            secret = cast(str, setup_data['secret'])
            if not pyotp.TOTP(secret).verify(normalized_code, valid_window=1):
                raise TwoFactorSetupError(
                    ErrorCode.REJECT,
                    '잘못된 인증 코드입니다.',
                )

            two_factor_auth = TwoFactorAuth(
                user=user,
                totp_secret=secret,
                recovery_key=cast(str, setup_data['recovery_key']),
            )
            two_factor_auth.save()
            del session[cls.SESSION_KEY]
        except TwoFactorSetupError:
            raise
        except Exception as error:
            raise TwoFactorSetupError(
                ErrorCode.REJECT,
                f'2FA 활성화에 실패했습니다: {str(error)}',
            ) from error
