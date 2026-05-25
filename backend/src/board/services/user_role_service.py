"""
User role service.
"""

from django.contrib.auth.models import User
from django.db import transaction

from board.models import Config, Profile


class UserRoleService:
    """Business logic for user role changes."""

    @staticmethod
    @transaction.atomic
    def set_profile_role(profile: Profile, role: str) -> Profile:
        profile.role = role
        profile.save(update_fields=['role'])
        return profile

    @staticmethod
    @transaction.atomic
    def set_profiles_role(profiles, role: str) -> int:
        count = 0
        for profile in profiles:
            UserRoleService.set_profile_role(profile, role)
            count += 1
        return count

    @staticmethod
    @transaction.atomic
    def set_users_role(users, role: str) -> int:
        user_ids = users.values_list('id', flat=True)
        profiles = Profile.objects.filter(user_id__in=user_ids)
        return UserRoleService.set_profiles_role(profiles, role)

    @staticmethod
    @transaction.atomic
    def set_superuser_status(user: User, is_superuser: bool) -> User:
        """
        Update Django admin access and keep first-admin publishing usable.

        Superusers should be able to open the admin area and publish the first
        post. Demoting admin access does not remove the editor role because
        writing permission is intentionally separate from staff access.
        """
        user.is_superuser = is_superuser
        user.is_staff = is_superuser
        user.save(update_fields=['is_superuser', 'is_staff'])

        if is_superuser:
            Config.objects.get_or_create(user=user)
            profile, _ = Profile.objects.get_or_create(user=user)
            if profile.role != Profile.Role.EDITOR:
                profile.role = Profile.Role.EDITOR
                profile.save(update_fields=['role'])

        return user
