from __future__ import annotations

from typing import TYPE_CHECKING

from modules.thumbnail import make_thumbnail

if TYPE_CHECKING:
    from board.models import Post


class PostThumbnailService:
    """Encapsulates Post title image thumbnail side effects."""

    @staticmethod
    def should_generate(post: 'Post') -> bool:
        if getattr(post, '_skip_thumbnail', False):
            return False

        if not post.pk:
            return bool(post.image)

        saved_post = post.__class__.objects.filter(id=post.id).first()
        if not saved_post:
            return False

        return saved_post.image != post.image

    @staticmethod
    def generate_thumbnail_set(post: 'Post') -> None:
        make_thumbnail(post, size=750, quality=50, thumbnail_type='preview')
        make_thumbnail(post, size=750, quality=85, thumbnail_type='minify')
        make_thumbnail(post, size=1920, quality=85)
