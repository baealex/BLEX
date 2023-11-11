from enum import Enum

from board.modules.requests import BooleanType

class CONFIG_TYPE(Enum):
    AGREE_DISPLAY_EMAIL = 'AGREE_DISPLAY_EMAIL'
    AGREE_SEND_EMAIL = 'AGREE_SEND_EMAIL'
    NOTIFY_POSTS_COMMENT = 'NOTIFY_POSTS_COMMENT'
    NOTIFY_POSTS_LIKE = 'NOTIFY_POSTS_LIKE'
    NOTIFY_POSTS_THANKS = 'NOTIFY_POSTS_THANKS'
    NOTIFY_POSTS_NO_THANKS = 'NOTIFY_POSTS_NO_THANKS'
    NOTIFY_COMMENT_LIKE = 'NOTIFY_COMMENT_LIKE'
    NOTIFY_MENTION = 'NOTIFY_MENTION'
    NOTIFY_FOLLOW = 'NOTIFY_FOLLOW'

CONFIG_MAP = {
    CONFIG_TYPE.AGREE_DISPLAY_EMAIL.value: {
        'name': CONFIG_TYPE.AGREE_DISPLAY_EMAIL.value,
        'type': BooleanType
    },
    CONFIG_TYPE.AGREE_SEND_EMAIL.value: {
        'name': CONFIG_TYPE.AGREE_SEND_EMAIL.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_LIKE.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_POSTS_THANKS.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_THANKS.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_NO_THANKS.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value: {
        'name': CONFIG_TYPE.NOTIFY_COMMENT_LIKE.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_MENTION.value: {
        'name': CONFIG_TYPE.NOTIFY_MENTION.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_FOLLOW.value: {
        'name': CONFIG_TYPE.NOTIFY_FOLLOW.value,
        'type': BooleanType,
    },
}

CONFIG_TYPES = CONFIG_MAP.keys()
