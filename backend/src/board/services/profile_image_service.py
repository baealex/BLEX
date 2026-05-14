from __future__ import annotations

from typing import TYPE_CHECKING

from modules.thumbnail import make_thumbnail

if TYPE_CHECKING:
    from board.models import Profile


class ProfileImageService:
    """Encapsulates Profile avatar image side effects."""

    @staticmethod
    def should_generate_avatar_thumbnail(profile: 'Profile') -> bool:
        if not profile.pk:
            return bool(profile.avatar)

        saved_profile = profile.__class__.objects.filter(id=profile.id).first()
        if not saved_profile:
            return False

        return saved_profile.avatar != profile.avatar

    @staticmethod
    def generate_avatar_thumbnail(profile: 'Profile') -> None:
        make_thumbnail(profile, size=500)
