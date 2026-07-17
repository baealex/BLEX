from django.contrib.auth.models import User
from django.db import transaction

from board.models import SocialAuth


class SocialAuthDisconnectError(Exception):
    pass


class SocialAuthConnectionService:
    """Disconnect social identities while preserving an account login path."""

    @staticmethod
    @transaction.atomic
    def disconnect(social_auth: SocialAuth) -> int:
        try:
            connection = (
                SocialAuth.objects.select_for_update()
                .only('id', 'user_id')
                .get(pk=social_auth.pk)
            )
        except SocialAuth.DoesNotExist as error:
            raise SocialAuthDisconnectError(
                '해제할 소셜 로그인 연동을 찾을 수 없습니다.',
            ) from error

        user = User.objects.select_for_update().get(pk=connection.user_id)
        has_another_connection = SocialAuth.objects.select_for_update().filter(
            user_id=user.pk,
        ).exclude(pk=connection.pk).exists()
        if not user.has_usable_password() and not has_another_connection:
            raise SocialAuthDisconnectError(
                '사용 가능한 비밀번호나 다른 소셜 로그인이 없어 연동을 '
                '해제할 수 없습니다.',
            )

        connection_id = connection.pk
        connection.delete()
        return connection_id
