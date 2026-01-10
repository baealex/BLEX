"""
Comment Service

Business logic for comment operations.
Extracted from views to improve testability and reusability.
"""

import re
from typing import Optional, Set, Tuple

from django.contrib.auth.models import User
from django.db import transaction

from board.constants.config_meta import CONFIG_TYPE
from board.models import Comment, Post
from board.modules.notify import create_notify
from board.modules.response import ErrorCode
from modules import markdown


class CommentValidationError(Exception):
    """Custom exception for comment validation errors"""
    def __init__(self, code: ErrorCode, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class CommentService:
    """Service class for handling comment-related business logic"""
    MENTION_PATTERN = re.compile(r'`@([a-zA-Z0-9\.]*)`\s?')

    @staticmethod
    def validate_user_can_comment(user: User) -> None:
        """
        Validate if user can create comments.

        Args:
            user: User instance

        Raises:
            CommentValidationError: If user cannot comment
        """
        if not user.is_active:
            raise CommentValidationError(
                ErrorCode.AUTHENTICATION,
                '로그인이 필요합니다.'
            )

    @staticmethod
    def validate_user_can_edit(user: User, comment: Comment) -> None:
        """
        Validate if user can edit the comment.

        Args:
            user: User instance
            comment: Comment instance

        Raises:
            CommentValidationError: If user cannot edit
        """
        if user != comment.author:
            raise CommentValidationError(
                ErrorCode.AUTHENTICATION,
                '댓글 수정 권한이 없습니다.'
            )

    @staticmethod
    def validate_user_can_delete(user: User, comment: Comment) -> None:
        """
        Validate if user can delete the comment.

        Args:
            user: User instance
            comment: Comment instance

        Raises:
            CommentValidationError: If user cannot delete
        """
        if user != comment.author:
            raise CommentValidationError(
                ErrorCode.AUTHENTICATION,
                '댓글 삭제 권한이 없습니다.'
            )

    @staticmethod
    def validate_user_can_like(user: User, comment: Comment) -> None:
        """
        Validate if user can like the comment.

        Args:
            user: User instance
            comment: Comment instance

        Raises:
            CommentValidationError: If user cannot like
        """
        if not user.is_active:
            raise CommentValidationError(
                ErrorCode.NEED_LOGIN,
                '로그인이 필요합니다.'
            )

        if user == comment.author:
            raise CommentValidationError(
                ErrorCode.AUTHENTICATION,
                '자신의 댓글은 추천할 수 없습니다.'
            )

        if comment.is_deleted():
            raise CommentValidationError(
                ErrorCode.REJECT,
                '삭제된 댓글입니다.'
            )

    @staticmethod
    def extract_mentioned_users(text_md: str) -> Set[str]:
        """
        Extract mentioned usernames from comment text.

        Args:
            text_md: Comment text in markdown

        Returns:
            Set of mentioned usernames
        """
        matches = CommentService.MENTION_PATTERN.findall(text_md)
        return set(matches)

    @staticmethod
    def get_post_commenters(post: Post) -> Set[str]:
        """
        Get all users who have commented on the post.

        Args:
            post: Post instance

        Returns:
            Set of usernames
        """
        commenters = Comment.objects.filter(
            post=post
        ).values_list('author__username', flat=True)
        return set(commenters)

    @staticmethod
    def notify_post_author(comment: Comment) -> None:
        """
        Send notification to post author about new comment.

        Args:
            comment: Comment instance
        """
        post = comment.post
        post_author = post.author

        if comment.author == post_author:
            return

        if not post_author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT):
            return

        send_notify_content = (
            f"'{post.title}'글에 "
            f"@{comment.author.username}님이 댓글을 남겼습니다. "
            f"#{comment.pk}"
        )
        create_notify(
            user=post_author,
            url=post.get_absolute_url(),
            content=send_notify_content
        )

    @staticmethod
    def notify_mentioned_users(comment: Comment) -> None:
        """
        Send notifications to mentioned users.

        Args:
            comment: Comment instance
        """
        post = comment.post
        mentioned_users = CommentService.extract_mentioned_users(comment.text_md)

        if not mentioned_users:
            return

        commenters = CommentService.get_post_commenters(post)

        for username in mentioned_users:
            if username not in commenters:
                continue

            try:
                user = User.objects.get(username=username)

                if user == comment.author:
                    continue

                if not user.config.get_meta(CONFIG_TYPE.NOTIFY_MENTION):
                    continue

                send_notify_content = (
                    f"'{post.title}' 글에서 "
                    f"@{comment.author.username}님이 "
                    f"회원님을 태그했습니다. #{comment.pk}"
                )
                create_notify(
                    user=user,
                    url=post.get_absolute_url(),
                    content=send_notify_content
                )
            except User.DoesNotExist:
                continue

    @staticmethod
    def notify_comment_like(comment: Comment, liker: User) -> None:
        """
        Send notification to comment author about like.

        Args:
            comment: Comment instance
            liker: User who liked the comment
        """
        if not comment.author.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE):
            return

        send_notify_content = (
            f"'{comment.post.title}'글에 작성한 "
            f"회원님의 #{comment.pk} 댓글을 "
            f"@{liker.username}님께서 추천했습니다."
        )
        create_notify(
            user=comment.author,
            url=comment.post.get_absolute_url(),
            content=send_notify_content
        )

    @staticmethod
    def notify_parent_comment_author(comment: Comment) -> None:
        """
        Send notification to parent comment author about reply.

        Args:
            comment: Reply comment instance
        """
        if not comment.parent:
            return

        parent_author = comment.parent.author

        # 삭제된 댓글이거나 자신의 댓글에 답글을 단 경우 알림 안 보냄
        if not parent_author or parent_author == comment.author:
            return

        if not parent_author.config.get_meta(CONFIG_TYPE.NOTIFY_POSTS_COMMENT):
            return

        send_notify_content = (
            f"'{comment.post.title}'글에 작성한 "
            f"회원님의 댓글에 @{comment.author.username}님이 "
            f"답글을 남겼습니다. #{comment.pk}"
        )
        create_notify(
            user=parent_author,
            url=comment.post.get_absolute_url(),
            content=send_notify_content
        )

    @staticmethod
    @transaction.atomic
    def create_comment(
        user: User,
        post: Post,
        text_md: str,
        parent: Optional[Comment] = None
    ) -> Comment:
        """
        Create new comment.

        Args:
            user: Comment author
            post: Post to comment on
            text_md: Comment text in markdown
            parent: Parent comment for nested replies (optional)

        Returns:
            Created Comment instance

        Raises:
            CommentValidationError: If validation fails
        """
        CommentService.validate_user_can_comment(user)

        # 1레벨 제한: 대댓글의 대댓글 방지
        if parent and parent.parent:
            raise CommentValidationError(
                ErrorCode.REJECT,
                '대댓글에는 답글을 달 수 없습니다.'
            )

        text_html = markdown.parse_to_html(text_md)

        comment = Comment(
            post=post,
            author=user,
            parent=parent,
            text_md=text_md,
            text_html=text_html
        )
        comment.save()
        comment.refresh_from_db()

        # 대댓글이면 부모 댓글 작성자에게 알림, 아니면 포스트 작성자에게 알림
        if parent:
            CommentService.notify_parent_comment_author(comment)
        else:
            CommentService.notify_post_author(comment)

        CommentService.notify_mentioned_users(comment)

        return comment

    @staticmethod
    @transaction.atomic
    def update_comment(comment: Comment, text_md: str) -> Comment:
        """
        Update comment text.

        Args:
            comment: Comment instance
            text_md: New comment text in markdown

        Returns:
            Updated Comment instance
        """
        text_html = markdown.parse_to_html(text_md)

        comment.text_md = text_md
        comment.text_html = text_html
        comment.edited = True
        comment.save()

        return comment

    @staticmethod
    @transaction.atomic
    def delete_comment(comment: Comment) -> Comment:
        """
        Soft delete comment by removing author.

        Args:
            comment: Comment instance

        Returns:
            Updated Comment instance
        """
        comment.author = None
        comment.save()
        return comment

    @staticmethod
    @transaction.atomic
    def toggle_like(user: User, comment: Comment) -> Tuple[bool, int]:
        """
        Toggle like on comment.

        Args:
            user: User who is liking/unliking
            comment: Comment instance

        Returns:
            Tuple of (is_liked, new_like_count)

        Raises:
            CommentValidationError: If validation fails
        """
        CommentService.validate_user_can_like(user, comment)

        if comment.likes.filter(id=user.id).exists():
            comment.likes.remove(user)
            comment.refresh_from_db()
            return False, comment.likes.count()
        else:
            comment.likes.add(user)
            comment.refresh_from_db()

            CommentService.notify_comment_like(comment, user)

            return True, comment.likes.count()

    @staticmethod
    def can_user_edit_comment(user: User, comment: Comment) -> bool:
        """
        Check if user can edit comment.

        Args:
            user: User instance
            comment: Comment instance

        Returns:
            True if user can edit, False otherwise
        """
        return user.is_authenticated and user == comment.author

    @staticmethod
    def can_user_delete_comment(user: User, comment: Comment) -> bool:
        """
        Check if user can delete comment.

        Args:
            user: User instance
            comment: Comment instance

        Returns:
            True if user can delete, False otherwise
        """
        return user.is_authenticated and (
            user == comment.author or user.is_staff
        )
