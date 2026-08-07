from dataclasses import dataclass
from datetime import datetime
from html import unescape

from django.contrib.auth.models import User
from django.db import transaction
from django.template.defaultfilters import truncatechars
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.translation import gettext

from board.models import EditHistory, Post, PostContent
from board.services.tag_service import TagService


class PostRevisionConflictError(Exception):
    pass


class PostRevisionRestoreError(Exception):
    pass


@dataclass(frozen=True)
class PostRevisionSnapshot:
    title: str
    subtitle: str
    content_html: str
    description: str
    tags: tuple[str, ...]


class PostRevisionService:
    PAGE_SIZE = 20
    MAX_PAGE_SIZE = 50

    @staticmethod
    def build_content_excerpt(content_html: str) -> str:
        content_text = unescape(strip_tags(content_html)).strip()
        return truncatechars(content_text, 160)

    @staticmethod
    def capture_snapshot(post: Post) -> PostRevisionSnapshot:
        content_html = (
            PostContent.objects.filter(post_id=post.id)
            .values_list('content_html', flat=True)
            .first()
            or ''
        )
        tags = tuple(
            post.tags.order_by('value').values_list('value', flat=True)
        )
        return PostRevisionSnapshot(
            title=post.title,
            subtitle=post.subtitle,
            content_html=content_html,
            description=post.meta_description,
            tags=tags,
        )

    @staticmethod
    def snapshot_from_history(history: EditHistory) -> PostRevisionSnapshot:
        return PostRevisionSnapshot(
            title=history.title,
            subtitle=history.subtitle,
            content_html=history.content,
            description=history.description,
            tags=tuple(history.tags),
        )

    @staticmethod
    def create_revision(
        post: Post,
        snapshot: PostRevisionSnapshot,
        *,
        change_type: str,
        source_updated_date: datetime | None,
        actor: User | None = None,
        restored_from: EditHistory | None = None,
    ) -> EditHistory:
        return EditHistory.objects.create(
            post=post,
            actor=actor,
            restored_from=restored_from,
            title=snapshot.title,
            subtitle=snapshot.subtitle,
            content=snapshot.content_html,
            content_excerpt=PostRevisionService.build_content_excerpt(
                snapshot.content_html,
            ),
            description=snapshot.description,
            tags=list(snapshot.tags),
            source_updated_date=source_updated_date,
            change_type=change_type,
        )

    @staticmethod
    def record_previous_snapshot_if_changed(
        post: Post,
        previous_snapshot: PostRevisionSnapshot,
        *,
        source_updated_date: datetime | None,
        actor: User | None = None,
    ) -> EditHistory | None:
        if PostRevisionService.capture_snapshot(post) == previous_snapshot:
            return None

        return PostRevisionService.create_revision(
            post,
            previous_snapshot,
            change_type=EditHistory.ChangeType.EDIT,
            source_updated_date=source_updated_date,
            actor=actor if actor is not None else post.author,
        )

    @staticmethod
    def serialize_summary(history: EditHistory) -> dict[str, object]:
        return {
            'id': history.id,
            'title': history.title,
            'subtitle': history.subtitle,
            'content_excerpt': history.content_excerpt or '',
            'tags': history.tags,
            'change_type': history.change_type,
            'can_restore': history.change_type != EditHistory.ChangeType.LEGACY,
            'actor': history.actor.username if history.actor else None,
            'restored_from_id': history.restored_from_id,
            'source_updated_date': (
                history.source_updated_date.isoformat()
                if history.source_updated_date
                else None
            ),
            'created_date': history.created_date.isoformat(),
        }

    @staticmethod
    def serialize_detail(history: EditHistory) -> dict[str, object]:
        return {
            **PostRevisionService.serialize_summary(history),
            'content_html': history.content,
            'content_text': unescape(strip_tags(history.content)).strip(),
            'description': history.description,
        }

    @staticmethod
    @transaction.atomic
    def delete_revision(post: Post, history: EditHistory) -> int:
        history = EditHistory.objects.select_for_update().get(
            pk=history.pk,
            post=post,
        )
        revision_id = history.pk
        history.delete()
        return revision_id

    @staticmethod
    @transaction.atomic
    def restore_revision(
        post: Post,
        history: EditHistory,
        *,
        actor: User,
        expected_updated_date: str,
    ) -> tuple[Post, bool]:
        try:
            post = Post.objects.select_for_update().get(pk=post.pk)
            history = EditHistory.objects.select_for_update().get(
                pk=history.pk,
                post=post,
            )
        except (Post.DoesNotExist, EditHistory.DoesNotExist) as error:
            raise PostRevisionRestoreError(
                gettext('The revision to restore could not be found.'),
            ) from error

        if history.change_type == EditHistory.ChangeType.LEGACY:
            raise PostRevisionRestoreError(
                gettext('Legacy revisions cannot be restored safely.'),
            )

        actual_updated_date = post.updated_date.isoformat()
        if expected_updated_date != actual_updated_date:
            raise PostRevisionConflictError(
                gettext(
                    'Another request has already changed the post. Refresh and '
                    'try again.'
                ),
            )

        current_snapshot = PostRevisionService.capture_snapshot(post)
        target_snapshot = PostRevisionService.snapshot_from_history(history)
        if current_snapshot == target_snapshot:
            return post, False
        tags_changed = current_snapshot.tags != target_snapshot.tags
        previous_updated_date = post.updated_date

        PostRevisionService.create_revision(
            post,
            current_snapshot,
            change_type=EditHistory.ChangeType.RESTORE,
            source_updated_date=post.updated_date,
            actor=actor,
            restored_from=history,
        )

        from board.services.post_service import PostService

        post._skip_revision_capture = True
        try:
            PostService.update_post(
                post=post,
                title=target_snapshot.title,
                subtitle=target_snapshot.subtitle,
                text_html=target_snapshot.content_html,
                description=target_snapshot.description,
                content_type='html',
            )

            if tags_changed:
                tag_objects = TagService.get_or_create_tags(set(target_snapshot.tags))
                post.tags.set(tag_objects.values())
                if post.updated_date == previous_updated_date:
                    post.updated_date = timezone.now()
                    post.save(update_fields=['updated_date'])
        finally:
            if hasattr(post, '_skip_revision_capture'):
                del post._skip_revision_capture

        return post, True
