from dataclasses import dataclass
from datetime import datetime

from board.html_utils import sanitize_content_html
from board.models import EditHistory, Post, PostContent


@dataclass(frozen=True)
class PostTimelapseFrame:
    title: str
    content_html: str
    saved_at: datetime
    stage: str


class PostTimelapseService:
    """Replays a post from its saved snapshots, oldest first, ending with the current post."""

    MAX_FRAMES = 80
    STAGE_DRAFT = 'draft'
    STAGE_PUBLISHED = 'published'
    LEGACY_UNCHANGED_VALUE = '_NO_CHANGED_'

    @staticmethod
    def has_history(post: Post) -> bool:
        return EditHistory.objects.filter(post=post).exists()

    @staticmethod
    def build_frames(post: Post) -> list[PostTimelapseFrame]:
        histories = list(
            EditHistory.objects.filter(post=post)
            .only(
                'title',
                'content',
                'change_type',
                'source_updated_date',
                'created_date',
            )
            .order_by('-created_date', '-id')
        )
        current_content_html = (
            PostContent.objects.filter(post_id=post.id)
            .values_list('content_html', flat=True)
            .first()
            or ''
        )
        newest_first = [
            PostTimelapseFrame(
                title=post.title,
                content_html=current_content_html,
                saved_at=post.updated_date,
                stage=(
                    PostTimelapseService.STAGE_PUBLISHED
                    if post.published_date
                    else PostTimelapseService.STAGE_DRAFT
                ),
            )
        ]
        for history in histories:
            later_frame = newest_first[-1]
            newest_first.append(
                PostTimelapseFrame(
                    title=PostTimelapseService.resolve_legacy_value(
                        history.title,
                        later_frame.title,
                    ),
                    content_html=PostTimelapseService.resolve_legacy_value(
                        history.content,
                        later_frame.content_html,
                    ),
                    saved_at=history.source_updated_date or history.created_date,
                    stage=(
                        PostTimelapseService.STAGE_DRAFT
                        if history.change_type == EditHistory.ChangeType.DRAFT
                        else PostTimelapseService.STAGE_PUBLISHED
                    ),
                )
            )
        return PostTimelapseService.collapse_unchanged_frames(
            list(reversed(newest_first)),
        )

    @staticmethod
    def resolve_legacy_value(value: str, later_value: str) -> str:
        """Legacy rows store a marker instead of a field that the edit did not change."""
        if value == PostTimelapseService.LEGACY_UNCHANGED_VALUE:
            return later_value
        return value

    @staticmethod
    def collapse_unchanged_frames(
        frames: list[PostTimelapseFrame],
    ) -> list[PostTimelapseFrame]:
        """Settings-only saves repeat the same text; keep the first frame of each run."""
        collapsed: list[PostTimelapseFrame] = []
        for frame in frames:
            if collapsed and (
                collapsed[-1].title == frame.title
                and collapsed[-1].content_html == frame.content_html
            ):
                continue
            collapsed.append(frame)
        return collapsed

    @staticmethod
    def sample_frames(
        frames: list[PostTimelapseFrame],
        limit: int,
    ) -> list[PostTimelapseFrame]:
        """Spread a long history evenly while always keeping the first and current frames."""
        if len(frames) <= limit:
            return frames
        last_index = len(frames) - 1
        indexes = sorted({
            round(position * last_index / (limit - 1))
            for position in range(limit)
        })
        return [frames[index] for index in indexes]

    @staticmethod
    def serialize_timelapse(post: Post) -> dict[str, object]:
        frames = PostTimelapseService.build_frames(post)
        visible_frames = PostTimelapseService.sample_frames(
            frames,
            PostTimelapseService.MAX_FRAMES,
        )
        return {
            'frames': [
                {
                    'title': frame.title,
                    'content_html': sanitize_content_html(frame.content_html),
                    'saved_at': frame.saved_at.isoformat(),
                    'stage': frame.stage,
                }
                for frame in visible_frames
            ],
            'total_count': len(frames),
            'published_at': (
                post.published_date.isoformat()
                if post.published_date
                else None
            ),
        }
