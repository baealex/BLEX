from __future__ import annotations

from django.contrib.auth.models import User
from django.db import transaction

from board.models import Notify


class NotificationCreationService:
    """Create a notification once before requesting external delivery."""

    @staticmethod
    def create(
        user: User,
        url: str,
        content: str,
        hidden_key: str | None = None,
    ) -> tuple[Notify, bool]:
        key = Notify.create_hash_key(
            user=user,
            url=url,
            content=content,
            hidden_key=hidden_key,
        )
        with transaction.atomic():
            notify, created = Notify.objects.get_or_create(
                key=key,
                defaults={
                    'user': user,
                    'url': url,
                    'content': content,
                },
            )

        if created:
            notify.send_notify()

        return notify, created
