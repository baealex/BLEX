from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from board.models import Post


class PostTrashError(Exception):
    pass


class PostTrashConflictError(PostTrashError):
    pass


@dataclass(frozen=True)
class PostTrashPage:
    posts: list[dict[str, object]]
    page: int
    total_count: int
    last_page: int


class PostTrashService:
    PAGE_SIZE = 10

    @staticmethod
    def get_user_trash(user: User) -> QuerySet[Post]:
        return (
            Post.all_objects.select_related('config')
            .only(
                'id', 'url', 'title', 'image', 'published_date',
                'updated_date', 'deleted_date', 'config__hide',
            )
            .filter(
                author=user,
                deleted_date__isnull=False,
            )
            .order_by('-deleted_date', '-id')
        )

    @staticmethod
    def source_status(post: Post) -> str:
        if post.published_date is None:
            return 'draft'
        if post.deleted_date and post.published_date > post.deleted_date:
            return 'scheduled'
        return 'published'

    @staticmethod
    def current_status(post: Post) -> str:
        if post.published_date is None:
            return 'draft'
        if post.published_date > timezone.now():
            return 'scheduled'
        return 'published'

    @staticmethod
    def serialize_post(post: Post) -> dict[str, object]:
        source_status = PostTrashService.source_status(post)
        return {
            'url': post.url,
            'title': post.title,
            'image': str(post.image) if post.image else None,
            'source_status': source_status,
            'published_date': (
                post.published_date.isoformat()
                if post.published_date
                else None
            ),
            'updated_date': post.updated_date.isoformat(),
            'deleted_date': post.deleted_date.isoformat(),
            'schedule_elapsed': bool(
                source_status == 'scheduled'
                and post.published_date
                and post.published_date <= timezone.now()
            ),
            'is_hide': post.config.hide,
        }

    @staticmethod
    def get_page(user: User, page: int) -> PostTrashPage:
        if page < 1:
            raise PostTrashError('휴지통 페이지 정보를 확인해주세요.')

        posts = PostTrashService.get_user_trash(user)
        total_count = posts.count()
        last_page = max(1, ceil(total_count / PostTrashService.PAGE_SIZE))
        if page > last_page:
            raise PostTrashError('휴지통 페이지 정보를 확인해주세요.')

        start = (page - 1) * PostTrashService.PAGE_SIZE
        page_posts = posts[start:start + PostTrashService.PAGE_SIZE]
        return PostTrashPage(
            posts=[PostTrashService.serialize_post(post) for post in page_posts],
            page=page,
            total_count=total_count,
            last_page=last_page,
        )

    @staticmethod
    @transaction.atomic
    def trash_post(post: Post) -> Post:
        try:
            post = Post.objects.select_for_update().get(pk=post.pk)
        except Post.DoesNotExist as error:
            raise PostTrashError('휴지통으로 옮길 포스트를 찾을 수 없습니다.') from error

        post.deleted_date = timezone.now()
        post.save(update_fields=['deleted_date'])
        return post

    @staticmethod
    def _lock_trashed_post(
        post: Post,
        expected_deleted_date: str,
    ) -> Post:
        try:
            post = Post.all_objects.select_for_update().get(
                pk=post.pk,
                deleted_date__isnull=False,
            )
        except Post.DoesNotExist as error:
            raise PostTrashError('휴지통 포스트를 찾을 수 없습니다.') from error

        if post.deleted_date.isoformat() != expected_deleted_date:
            raise PostTrashConflictError(
                '휴지통 상태가 바뀌었습니다. 목록을 새로고침한 뒤 다시 시도해주세요.',
            )
        return post

    @staticmethod
    @transaction.atomic
    def restore_post(
        post: Post,
        *,
        expected_deleted_date: str,
    ) -> Post:
        post = PostTrashService._lock_trashed_post(
            post,
            expected_deleted_date,
        )
        post.deleted_date = None
        post.save(update_fields=['deleted_date'])
        return post

    @staticmethod
    @transaction.atomic
    def purge_post(
        post: Post,
        *,
        expected_deleted_date: str,
    ) -> int:
        post = PostTrashService._lock_trashed_post(
            post,
            expected_deleted_date,
        )
        post_id = post.id
        post.delete()
        return post_id
