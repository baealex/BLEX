from board.models import Profile, WebhookSubscription, SiteContentScope
from board.modules.response import StatusError, ErrorCode


class WebhookApiService:
    """API-facing policy and serialization helpers for webhook channels."""

    @staticmethod
    def get_authenticated_profile(request):
        if not request.user.is_authenticated:
            return None, StatusError(ErrorCode.NEED_LOGIN, 'Login required')

        try:
            profile = Profile.objects.get(user=request.user)
            return profile, None
        except Profile.DoesNotExist:
            return None, StatusError(ErrorCode.NOT_FOUND, 'Profile not found')

    @staticmethod
    def ensure_staff(request):
        if not request.user.is_authenticated:
            return StatusError(ErrorCode.NEED_LOGIN, 'Login required')
        if not request.user.is_staff:
            return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')
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
