"""
Author invite service.
"""

from __future__ import annotations

import secrets

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from board.models import AuthorInvite, Config, Profile
from board.services.user_role_service import UserRoleService


class AuthorInviteError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class AuthorInviteService:
    CODE_BYTES = 12
    LIST_LIMIT = 20

    @staticmethod
    def generate_code() -> str:
        while True:
            code = secrets.token_urlsafe(AuthorInviteService.CODE_BYTES)
            if not AuthorInvite.objects.filter(code=code).exists():
                return code

    @staticmethod
    @transaction.atomic
    def create_invite(created_by: User, note: str = '') -> AuthorInvite:
        return AuthorInvite.objects.create(
            code=AuthorInviteService.generate_code(),
            created_by=created_by,
            note=(note or '').strip()[:120],
        )

    @staticmethod
    def list_invites() -> list[dict]:
        invites = AuthorInvite.objects.select_related(
            'created_by',
            'claimed_by',
        ).order_by('-created_date')[:AuthorInviteService.LIST_LIMIT]
        return [AuthorInviteService.serialize_invite(invite) for invite in invites]

    @staticmethod
    @transaction.atomic
    def delete_invite(invite_id: int) -> None:
        invite = AuthorInvite.objects.select_for_update().get(pk=invite_id)
        if invite.claimed_by_id is not None:
            raise AuthorInviteError('이미 사용된 초대 링크는 삭제할 수 없습니다.')

        invite.delete()

    @staticmethod
    def serialize_invite(invite: AuthorInvite) -> dict:
        return {
            'id': invite.id,
            'code': invite.code,
            'note': invite.note,
            'signup_url': f'/sign?invite={invite.code}',
            'is_active': invite.is_active,
            'is_claimed': invite.claimed_by_id is not None,
            'created_by': invite.created_by.username if invite.created_by else '',
            'claimed_by': invite.claimed_by.username if invite.claimed_by else '',
            'created_date': invite.created_date.isoformat() if invite.created_date else None,
            'claimed_date': invite.claimed_date.isoformat() if invite.claimed_date else None,
        }

    @staticmethod
    def validate_invite_code(code: str) -> AuthorInvite | None:
        code = (code or '').strip()
        if not code:
            return None

        try:
            invite = AuthorInvite.objects.get(code=code)
        except AuthorInvite.DoesNotExist:
            raise AuthorInviteError('유효하지 않은 초대 코드입니다.')

        if not invite.is_active or invite.claimed_by_id is not None:
            raise AuthorInviteError('이미 사용되었거나 비활성화된 초대 코드입니다.')

        return invite

    @staticmethod
    @transaction.atomic
    def redeem_invite(invite: AuthorInvite | None, user: User) -> None:
        if invite is None:
            return

        invite = AuthorInvite.objects.select_for_update().get(pk=invite.pk)
        if not invite.is_active or invite.claimed_by_id is not None:
            raise AuthorInviteError('이미 사용되었거나 비활성화된 초대 코드입니다.')

        profile, _ = Profile.objects.get_or_create(user=user)
        UserRoleService.set_profile_role(profile, Profile.Role.EDITOR)
        Config.objects.get_or_create(user=user)

        invite.claimed_by = user
        invite.claimed_date = timezone.now()
        invite.is_active = False
        invite.save(update_fields=['claimed_by', 'claimed_date', 'is_active'])
