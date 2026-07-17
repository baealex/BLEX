from board.services.notification_creation_service import (
    NotificationCreationService,
)


def create_notify(user, url: str, content: str, hidden_key: str = None):
    NotificationCreationService.create(
        user=user,
        url=url,
        content=content,
        hidden_key=hidden_key,
    )
