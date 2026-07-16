from django.db.models import (
    BooleanField,
    Case,
    Count,
    Exists,
    OuterRef,
    Prefetch,
    Value,
    When,
)

from board.models import Comment, Post
from board.services.public_post_service import PublicPostService


class CommentListService:
    """Build and serialize post comment list API responses."""

    @staticmethod
    def get_post_parent_comments(post_id: int, user_id: int):
        replies_queryset = CommentListService.annotate_comment_queryset(
            Comment.objects.select_related(
                'author',
                'author__profile',
            ).only(
                'id',
                'author_id',
                'parent_id',
                'text_html',
                'edited',
                'created_date',
                'author__username',
                'author__profile__avatar',
            ),
            user_id,
        ).order_by('created_date')

        return CommentListService.annotate_comment_queryset(
            Comment.objects.select_related(
                'author',
                'author__profile',
            ).only(
                'id',
                'author_id',
                'parent_id',
                'text_html',
                'edited',
                'created_date',
                'author__username',
                'author__profile__avatar',
            ),
            user_id,
        ).prefetch_related(
            Prefetch('replies', queryset=replies_queryset)
        ).filter(
            post_id=post_id,
            parent__isnull=True,
        ).order_by('created_date')

    @staticmethod
    def annotate_comment_queryset(queryset, user_id: int):
        if user_id < 1:
            return queryset.annotate(
                count_likes=Count('likes', distinct=True),
                has_liked=Value(False, output_field=BooleanField()),
            )

        return queryset.annotate(
            count_likes=Count('likes', distinct=True),
            has_liked=Case(
                When(
                    Exists(
                        Comment.objects.filter(
                            id=OuterRef('id'),
                            likes__id=user_id,
                        )
                    ),
                    then=Value(True),
                ),
                default=Value(False),
            ),
        )

    @staticmethod
    def serialize_post_comments(post_url: str, user) -> dict:
        user_id = user.id if user.id else -1
        is_authenticated = user.is_authenticated
        post = PublicPostService.filter_public_posts(
            Post.objects.select_related('config').only(
                'id',
                'config__block_comment',
            )
        ).filter(url=post_url).first()

        if not post:
            return {
                'can_comment': False,
                'comments': [],
            }

        can_post_accept_replies = not post.config.block_comment
        parent_comments = CommentListService.get_post_parent_comments(post.id, user_id)

        return {
            'can_comment': can_post_accept_replies,
            'comments': [
                CommentListService.serialize_comment(
                    comment,
                    user_id=user_id,
                    is_authenticated=is_authenticated,
                    can_post_accept_replies=can_post_accept_replies,
                )
                for comment in parent_comments
            ]
        }

    @staticmethod
    def serialize_comment(
        comment,
        user_id: int,
        is_authenticated: bool,
        can_post_accept_replies: bool | None = None,
    ) -> dict:
        return {
            **CommentListService.serialize_comment_base(
                comment,
                user_id=user_id,
                is_authenticated=is_authenticated,
                can_post_accept_replies=can_post_accept_replies,
            ),
            'replies': [
                CommentListService.serialize_reply(
                    reply,
                    parent_id=comment.id,
                    user_id=user_id,
                    is_authenticated=is_authenticated,
                    can_post_accept_replies=can_post_accept_replies,
                )
                for reply in comment.replies.all()
            ],
        }

    @staticmethod
    def serialize_created_comment(comment, user) -> dict:
        user_id = user.id if user.id else -1
        is_authenticated = user.is_authenticated

        return CommentListService.serialize_comment_base(
            comment,
            parent_id=comment.parent_id,
            user_id=user_id,
            is_authenticated=is_authenticated,
        )

    @staticmethod
    def serialize_comment_base(
        comment,
        user_id: int,
        is_authenticated: bool,
        parent_id: int | None = None,
        can_post_accept_replies: bool | None = None,
    ) -> dict:
        is_mine = is_authenticated and comment.author_id == user_id
        is_deleted = comment.is_deleted()
        payload = {
            'id': comment.id,
            'author': comment.author_username(),
            'author_image': None if not comment.author else comment.author.profile.get_thumbnail(),
            'is_mine': is_mine,
            'is_edited': comment.edited,
            'is_deleted': is_deleted,
            'rendered_content': comment.get_text_html(),
            'created_date': comment.time_since(),
            'count_likes': CommentListService.get_count_likes(comment),
            'is_liked': CommentListService.get_has_liked(comment, user_id),
            'permissions': CommentListService.serialize_permissions(
                comment,
                user_id=user_id,
                is_authenticated=is_authenticated,
                is_mine=is_mine,
                is_deleted=is_deleted,
                can_post_accept_replies=can_post_accept_replies,
            ),
        }

        if parent_id:
            payload['parent_id'] = parent_id

        return payload

    @staticmethod
    def serialize_reply(
        reply,
        parent_id: int,
        user_id: int,
        is_authenticated: bool,
        can_post_accept_replies: bool | None = None,
    ) -> dict:
        return CommentListService.serialize_comment_base(
            reply,
            parent_id=parent_id,
            user_id=user_id,
            is_authenticated=is_authenticated,
            can_post_accept_replies=can_post_accept_replies,
        )

    @staticmethod
    def serialize_permissions(
        comment,
        user_id: int,
        is_authenticated: bool,
        is_mine: bool | None = None,
        is_deleted: bool | None = None,
        can_post_accept_replies: bool | None = None,
    ) -> dict:
        if is_mine is None:
            is_mine = is_authenticated and comment.author_id == user_id
        if is_deleted is None:
            is_deleted = comment.is_deleted()
        if can_post_accept_replies is None:
            can_post_accept_replies = not comment.post.config.block_comment

        return {
            'can_edit': is_mine and not is_deleted,
            'can_delete': is_mine and not is_deleted,
            'can_like': is_authenticated and not is_mine and not is_deleted,
            'can_reply': is_authenticated and not is_deleted and can_post_accept_replies,
        }

    @staticmethod
    def get_count_likes(comment) -> int:
        if hasattr(comment, 'count_likes'):
            return comment.count_likes
        return comment.likes.count()

    @staticmethod
    def get_has_liked(comment, user_id: int) -> bool:
        if hasattr(comment, 'has_liked'):
            return comment.has_liked
        if user_id < 1:
            return False
        return comment.likes.filter(id=user_id).exists()
