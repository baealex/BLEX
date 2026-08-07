from __future__ import annotations

import json
from collections.abc import Mapping
from enum import StrEnum

from django.utils.translation import gettext, gettext_noop


class NotificationMessageKey(StrEnum):
    POST_COMMENTED = 'post.commented'
    COMMENT_MENTIONED = 'comment.mentioned'
    COMMENT_LIKED = 'comment.liked'
    COMMENT_REPLIED = 'comment.replied'
    POST_LIKED = 'post.liked'


NOTIFICATION_MESSAGE_TEMPLATES = {
    NotificationMessageKey.POST_COMMENTED: gettext_noop(
        '@%(actor)s commented on "%(post_title)s". #%(comment_id)s'
    ),
    NotificationMessageKey.COMMENT_MENTIONED: gettext_noop(
        '@%(actor)s mentioned you in "%(post_title)s". #%(comment_id)s'
    ),
    NotificationMessageKey.COMMENT_LIKED: gettext_noop(
        '@%(actor)s liked your comment #%(comment_id)s on "%(post_title)s".'
    ),
    NotificationMessageKey.COMMENT_REPLIED: gettext_noop(
        '@%(actor)s replied to your comment on "%(post_title)s". '
        '#%(comment_id)s'
    ),
    NotificationMessageKey.POST_LIKED: gettext_noop(
        '@%(actor)s liked "%(post_title)s".'
    ),
}


class NotificationMessageService:
    """Render structured system notifications in the active UI language."""

    @staticmethod
    def normalize_params(params: Mapping[str, object]) -> dict[str, object]:
        return {
            str(key): value
            for key, value in params.items()
        }

    @staticmethod
    def render(
        message_key: str,
        message_params: Mapping[str, object],
        *,
        fallback: str = '',
    ) -> str:
        try:
            normalized_key = NotificationMessageKey(message_key)
        except ValueError:
            return fallback

        source_message = NOTIFICATION_MESSAGE_TEMPLATES.get(normalized_key)
        if source_message is None:
            return fallback

        try:
            return gettext(source_message) % message_params
        except (KeyError, TypeError, ValueError):
            return fallback

    @staticmethod
    def identity(
        message_key: str,
        message_params: Mapping[str, object],
    ) -> str:
        serialized_params = json.dumps(
            message_params,
            ensure_ascii=False,
            sort_keys=True,
            separators=(',', ':'),
        )
        return f'{message_key}:{serialized_params}'
