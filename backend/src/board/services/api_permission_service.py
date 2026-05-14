from __future__ import annotations

from typing import Optional

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpResponse

from board.modules.response import ErrorCode, StatusError


class ApiPermissionService:
    """Shared permission helpers for API views that return StatusError."""

    @staticmethod
    def require_login(user: User | AnonymousUser) -> Optional[HttpResponse]:
        if not user.is_authenticated or not user.is_active:
            return StatusError(ErrorCode.NEED_LOGIN, '로그인이 필요합니다.')
        return None

    @staticmethod
    def require_editor(user: User | AnonymousUser) -> Optional[HttpResponse]:
        login_error = ApiPermissionService.require_login(user)
        if login_error:
            return login_error

        if not hasattr(user, 'profile') or not user.profile.is_editor():
            return StatusError(ErrorCode.REJECT, '에디터 권한이 필요합니다.')

        return None

    @staticmethod
    def require_staff(user: User | AnonymousUser) -> Optional[HttpResponse]:
        if not user.is_authenticated or not user.is_active:
            return StatusError(ErrorCode.NEED_LOGIN)

        if not user.is_staff:
            return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

        return None

    @staticmethod
    def require_owner(user: User | AnonymousUser, owner: User) -> Optional[HttpResponse]:
        login_error = ApiPermissionService.require_login(user)
        if login_error:
            return login_error

        if user != owner:
            return StatusError(ErrorCode.AUTHENTICATION, '권한이 없습니다.')

        return None
