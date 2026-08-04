from django.utils.translation import gettext, gettext_noop

from board.modules.response import StatusError
from board.services.pinned_post_service import PinnedPostError


PINNED_POST_ERROR_MESSAGES = {
    'pinned_posts.already_pinned': gettext_noop('This post is already pinned.'),
    'pinned_posts.editor_required': gettext_noop('Author access is required.'),
    'pinned_posts.invalid_page': gettext_noop('Invalid page number.'),
    'pinned_posts.limit_reached': gettext_noop('You can pin up to %(count)s posts.'),
    'pinned_posts.post_not_found': gettext_noop('Could not find this post.'),
    'pinned_posts.hidden_post': gettext_noop('Hidden posts cannot be pinned.'),
    'pinned_posts.published_only': gettext_noop('Only published posts can be pinned.'),
    'pinned_posts.pinned_post_not_found': gettext_noop('Could not find this pinned post.'),
    'pinned_posts.reorder_contains_unpinned': gettext_noop(
        'The new order includes a post that is not pinned: %(url)s'
    ),
}


def pinned_post_error_response(error: PinnedPostError):
    message_source = PINNED_POST_ERROR_MESSAGES.get(error.message_key)
    if message_source is None:
        return StatusError(
            error.code,
            gettext('Could not update pinned posts.'),
            message_key='pinned_posts.unknown',
            message_params={},
        )

    return StatusError(
        error.code,
        gettext(message_source) % error.message_params,
        message_key=error.message_key,
        message_params=error.message_params,
    )
