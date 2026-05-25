from __future__ import annotations

from django.contrib.auth.models import AnonymousUser, User


class AuthoringPermissionService:
    """Shared policy for authoring-only capabilities."""

    @staticmethod
    def is_active_editor(user: User | AnonymousUser) -> bool:
        if not user.is_authenticated or not user.is_active:
            return False

        if not hasattr(user, 'profile'):
            return False

        return user.profile.is_editor()

    @staticmethod
    def can_manage_own_content(user: User | AnonymousUser, owner: User) -> bool:
        if not AuthoringPermissionService.is_active_editor(user):
            return False

        return user == owner
