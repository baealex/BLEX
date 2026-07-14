from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Callable, Iterator, Protocol

from board.models import Post


class ChunkedImageFile(Protocol):
    """Uploaded image interface required for hashing and assignment."""

    def seek(self, offset: int, whence: int = 0) -> int:
        ...

    def chunks(self, chunk_size: int | None = None) -> Iterator[bytes]:
        ...


ImageHashComputer = Callable[[ChunkedImageFile], str]
ImageSharedChecker = Callable[[str, int], bool]


@dataclass(frozen=True)
class PostImageMutationResult:
    """Describes the in-memory image mutation performed for a post."""

    changed: bool
    reused_existing: bool
    storage_file_deleted: bool


class PostImageService:
    """Owns post image hashing, deduplication, replacement, and deletion."""

    @staticmethod
    def compute_image_hash(image_file: ChunkedImageFile) -> str:
        """Compute the existing SHA-256 image identity and reset the file."""
        sha256 = hashlib.sha256()
        image_file.seek(0)
        for chunk in image_file.chunks():
            sha256.update(chunk)
        image_file.seek(0)
        return sha256.hexdigest()

    @staticmethod
    def is_image_shared(image_name: str, exclude_post_id: int) -> bool:
        """Return whether another post references the same storage path."""
        return Post.all_objects.filter(
            image=image_name,
        ).exclude(id=exclude_post_id).exists()

    @staticmethod
    def _delete_current_if_unshared(
        post: Post,
        is_image_shared: ImageSharedChecker,
    ) -> bool:
        if not post.image:
            return False
        if post.pk and is_image_shared(post.image.name, post.pk):
            return False

        post.image.delete(save=False)
        return True

    @staticmethod
    def set_image_with_dedup(
        post: Post,
        image: ChunkedImageFile | None = None,
        image_delete: bool = False,
        *,
        compute_image_hash: ImageHashComputer | None = None,
        is_image_shared: ImageSharedChecker | None = None,
    ) -> PostImageMutationResult:
        """Mutate a post image while preserving the legacy storage lifecycle."""
        hash_image = compute_image_hash or PostImageService.compute_image_hash
        check_shared = is_image_shared or PostImageService.is_image_shared

        if image_delete:
            changed = bool(post.image or post.image_hash)
            storage_file_deleted = PostImageService._delete_current_if_unshared(
                post,
                check_shared,
            )
            post.image = None
            post.image_hash = ''
            return PostImageMutationResult(
                changed=changed,
                reused_existing=False,
                storage_file_deleted=storage_file_deleted,
            )

        if image is None:
            return PostImageMutationResult(
                changed=False,
                reused_existing=False,
                storage_file_deleted=False,
            )

        new_hash = hash_image(image)
        if (
            post.pk
            and post.image
            and post.image_hash == new_hash
            and post.image.storage.exists(post.image.name)
        ):
            return PostImageMutationResult(
                changed=False,
                reused_existing=False,
                storage_file_deleted=False,
            )

        existing_images = Post.all_objects.filter(
            image_hash=new_hash,
        ).exclude(image='')
        if post.pk:
            existing_images = existing_images.exclude(pk=post.pk)

        existing = existing_images.first()
        if existing and existing.image and existing.image.storage.exists(existing.image.name):
            storage_file_deleted = PostImageService._delete_current_if_unshared(
                post,
                check_shared,
            )
            post.image.name = existing.image.name
            post.image_hash = new_hash
            post._skip_thumbnail = True
            return PostImageMutationResult(
                changed=True,
                reused_existing=True,
                storage_file_deleted=storage_file_deleted,
            )

        storage_file_deleted = PostImageService._delete_current_if_unshared(
            post,
            check_shared,
        )
        post.image = image
        post.image_hash = new_hash
        return PostImageMutationResult(
            changed=True,
            reused_existing=False,
            storage_file_deleted=storage_file_deleted,
        )
