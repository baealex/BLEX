from enum import Enum


class WEBHOOK_EVENT(Enum):
    """웹훅 이벤트 타입"""
    POST_PUBLISHED = 'post.published'  # 새 글 발행
    NOTIFY_CREATED = 'notify.created'  # 알림 생성
    COMMENT_CREATED = 'comment.created'  # 댓글 생성
    COMMENT_LIKED = 'comment.liked'  # 댓글 좋아요
    POST_LIKED = 'post.liked'  # 글 좋아요


class WEBHOOK_PROVIDER(Enum):
    """웹훅 제공자 타입"""
    GENERIC = 'generic'  # 일반 웹훅
    DISCORD = 'discord'  # Discord 웹훅
    SLACK = 'slack'  # Slack 웹훅


# 이벤트별 설명
WEBHOOK_EVENT_DESCRIPTIONS = {
    WEBHOOK_EVENT.POST_PUBLISHED.value: '새 글이 발행되었을 때',
    WEBHOOK_EVENT.NOTIFY_CREATED.value: '알림이 생성되었을 때',
    WEBHOOK_EVENT.COMMENT_CREATED.value: '댓글이 작성되었을 때',
    WEBHOOK_EVENT.COMMENT_LIKED.value: '댓글에 좋아요가 눌렸을 때',
    WEBHOOK_EVENT.POST_LIKED.value: '글에 좋아요가 눌렸을 때',
}

# 제공자별 설명
WEBHOOK_PROVIDER_DESCRIPTIONS = {
    WEBHOOK_PROVIDER.GENERIC.value: '일반 웹훅 (JSON POST)',
    WEBHOOK_PROVIDER.DISCORD.value: 'Discord 웹훅',
    WEBHOOK_PROVIDER.SLACK.value: 'Slack 웹훅',
}
