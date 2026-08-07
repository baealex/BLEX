from django.utils.translation import gettext as _

from board.models import Profile, WebhookSubscription, SiteContentScope
from board.modules.response import StatusError, ErrorCode


class WebhookApiService:
    """API-facing policy and serialization helpers for webhook channels."""

    @staticmethod
    def get_authenticated_profile(request):
        if not request.user.is_authenticated:
            return None, StatusError(ErrorCode.NEED_LOGIN, _('Login required.'))

        try:
            # Use the reverse one-to-one relation so the profile loaded by the
            # editor permission decorator is reused instead of queried again.
            profile = request.user.profile
            if not profile.is_editor():
                return None, StatusError(ErrorCode.REJECT, _('Author access is required.'))
            return profile, None
        except Profile.DoesNotExist:
            return None, StatusError(ErrorCode.NOT_FOUND, _('Profile not found.'))

    @staticmethod
    def ensure_staff(request):
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.NEED_LOGIN, _('Login required.'))
        if not request.user.is_staff:
            return StatusError(ErrorCode.REJECT, _('Administrator access is required.'))
        return None

    @staticmethod
    def get_user_channels(profile: Profile):
        return WebhookSubscription.objects.filter(
            scope=SiteContentScope.USER,
            author=profile,
        )

    @staticmethod
    def get_global_channels():
        return WebhookSubscription.objects.filter(
            scope=SiteContentScope.GLOBAL,
        )

    @staticmethod
    def serialize_channels(channels) -> dict:
        return {
            'channels': list(
                channels.values(
                    'id',
                    'name',
                    'webhook_url',
                    'is_active',
                    'failure_count',
                    'created_date',
                )
            )
        }

    @staticmethod
    def mutation_success(channel) -> dict:
        return {
            'success': True,
            'channel_id': channel.id,
        }

    @staticmethod
    def delete_success() -> dict:
        return {'success': True}
