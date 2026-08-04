from board.services.notification_creation_service import (
    NotificationCreationService,
)
from board.services.notification_message_service import NotificationMessageKey


def create_notify(
    user,
    url: str,
    content: str,
    hidden_key: str | None = None,
) -> None:
    NotificationCreationService.create(
        user=user,
        url=url,
        content=content,
        hidden_key=hidden_key,
    )


def create_system_notify(
    user,
    url: str,
    message_key: NotificationMessageKey | str,
    message_params: dict[str, object],
    hidden_key: str | None = None,
) -> None:
    NotificationCreationService.create_system(
        user=user,
        url=url,
        message_key=message_key,
        message_params=message_params,
        hidden_key=hidden_key,
    )
