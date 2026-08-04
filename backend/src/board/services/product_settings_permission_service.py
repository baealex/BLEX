from __future__ import annotations

from typing import Optional

from django.contrib.auth.models import AnonymousUser, User
from django.http import HttpResponse
from django.utils.translation import gettext

from board.models import SiteSetting
from board.modules.response import ErrorCode, StatusError
from board.services.api_permission_service import ApiPermissionService


class ProductSettingsPermissionService:
    """Permission policy for site-wide product settings."""

    @staticmethod
    def is_active_staff(user: User | AnonymousUser) -> bool:
        return bool(user.is_authenticated and user.is_active and user.is_staff)

    @classmethod
    def can_manage_site_settings(cls, user: User | AnonymousUser) -> bool:
        if not cls.is_active_staff(user):
            return False

        return bool(
            user.is_superuser
            or user.has_perm(
                f'{SiteSetting._meta.app_label}.change_{SiteSetting._meta.model_name}',
            )
        )

    @classmethod
    def can_manage_login_settings(cls, user: User | AnonymousUser) -> bool:
        return cls.is_active_staff(user) and user.is_superuser

    @classmethod
    def can_manage_integration_settings(cls, user: User | AnonymousUser) -> bool:
        return cls.is_active_staff(user) and user.is_superuser

    @classmethod
    def can_manage_global_code(cls, user: User | AnonymousUser) -> bool:
        return cls.is_active_staff(user) and user.is_superuser

    @classmethod
    def can_manage_utilities(cls, user: User | AnonymousUser) -> bool:
        return cls.is_active_staff(user) and user.is_superuser

    @classmethod
    def require_site_settings(
        cls,
        user: User | AnonymousUser,
    ) -> Optional[HttpResponse]:
        staff_error = ApiPermissionService.require_staff(user)
        if staff_error:
            return staff_error

        if not cls.can_manage_site_settings(user):
            return StatusError(
                ErrorCode.REJECT,
                gettext('Permission to change site settings is required.'),
            )

        return None

    @staticmethod
    def require_login_settings(user: User | AnonymousUser) -> Optional[HttpResponse]:
        return ApiPermissionService.require_superuser(user)

    @staticmethod
    def require_integration_settings(user: User | AnonymousUser) -> Optional[HttpResponse]:
        return ApiPermissionService.require_superuser(user)

    @staticmethod
    def require_global_code(user: User | AnonymousUser) -> Optional[HttpResponse]:
        return ApiPermissionService.require_superuser(user)

    @classmethod
    def get_capabilities(cls, user: User | AnonymousUser) -> dict[str, bool]:
        return {
            'canManageSiteSettings': cls.can_manage_site_settings(user),
            'canManageLoginSettings': cls.can_manage_login_settings(user),
            'canManageIntegrationSettings': cls.can_manage_integration_settings(user),
            'canManageUtilities': cls.can_manage_utilities(user),
        }
