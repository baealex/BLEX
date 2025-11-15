from enum import Enum

from board.modules.requests import BooleanType

class CONFIG_TYPE(Enum):
    NOTIFY_POSTS_COMMENT = 'NOTIFY_POSTS_COMMENT'
    NOTIFY_POSTS_LIKE = 'NOTIFY_POSTS_LIKE'
    NOTIFY_COMMENT_LIKE = 'NOTIFY_COMMENT_LIKE'
    NOTIFY_MENTION = 'NOTIFY_MENTION'

CONFIG_MAP = {
    CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_COMMENT.value,
        'type': BooleanType,
    },
    CONFIG_TYPE.NOTIFY_POSTS_LIKE.value: {
        'name': CONFIG_TYPE.NOTIFY_POSTS_LIKE.value,
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
}

CONFIG_TYPES = CONFIG_MAP.keys()
