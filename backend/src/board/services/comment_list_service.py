from django.db.models import Case, Count, Exists, OuterRef, Prefetch, Value, When

from board.models import Comment
from board.services.public_post_service import PublicPostService


class CommentListService:
    """Build and serialize post comment list API responses."""

    @staticmethod
    def get_post_parent_comments(post_url: str, user_id: int):
        replies_queryset = CommentListService.annotate_comment_queryset(
            Comment.objects.select_related('author', 'author__profile'),
            user_id,
        ).order_by('created_date')

        return CommentListService.annotate_comment_queryset(
            Comment.objects.select_related('author', 'author__profile'),
            user_id,
        ).prefetch_related(
            Prefetch('replies', queryset=replies_queryset)
        ).filter(
            PublicPostService.build_public_filter('post'),
            post__url=post_url,
            parent__isnull=True,
        ).order_by('created_date')

    @staticmethod
    def annotate_comment_queryset(queryset, user_id: int):
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
        parent_comments = CommentListService.get_post_parent_comments(post_url, user_id)

        return {
            'comments': [
                CommentListService.serialize_comment(
                    comment,
                    user_id=user_id,
                    is_authenticated=is_authenticated,
                )
                for comment in parent_comments
            ]
        }

    @staticmethod
    def serialize_comment(comment, user_id: int, is_authenticated: bool) -> dict:
        return {
            **CommentListService.serialize_comment_base(
                comment,
                user_id=user_id,
                is_authenticated=is_authenticated,
            ),
            'replies': [
                CommentListService.serialize_reply(
                    reply,
                    parent_id=comment.id,
                    user_id=user_id,
                    is_authenticated=is_authenticated,
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
    ) -> dict:
        payload = {
            'id': comment.id,
            'author': comment.author_username(),
            'author_image': None if not comment.author else comment.author.profile.get_thumbnail(),
            'is_mine': is_authenticated and comment.author_id == user_id,
            'is_edited': comment.edited,
            'is_deleted': comment.is_deleted(),
            'rendered_content': comment.get_text_html(),
            'created_date': comment.time_since(),
            'count_likes': CommentListService.get_count_likes(comment),
            'is_liked': CommentListService.get_has_liked(comment, user_id),
            'permissions': CommentListService.serialize_permissions(
                comment,
                user_id=user_id,
                is_authenticated=is_authenticated,
            ),
        }

        if parent_id:
            payload['parent_id'] = parent_id

        return payload

    @staticmethod
    def serialize_reply(reply, parent_id: int, user_id: int, is_authenticated: bool) -> dict:
        return CommentListService.serialize_comment_base(
            reply,
            parent_id=parent_id,
            user_id=user_id,
            is_authenticated=is_authenticated,
        )

    @staticmethod
    def serialize_permissions(comment, user_id: int, is_authenticated: bool) -> dict:
        is_mine = is_authenticated and comment.author_id == user_id
        is_deleted = comment.is_deleted()

        return {
            'can_edit': is_mine and not is_deleted,
            'can_delete': is_mine and not is_deleted,
            'can_like': is_authenticated and not is_mine and not is_deleted,
            'can_reply': is_authenticated and not is_deleted,
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
