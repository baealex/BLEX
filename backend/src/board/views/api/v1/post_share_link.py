from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from board.decorators import api_editor_required_methods
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.post_share_link_service import PostShareLinkService


def invalid_label_response() -> HttpResponse:
    limit = PostShareLinkService.LABEL_LIMIT
    return StatusError(
        ErrorCode.VALIDATE,
        gettext('Enter a share link name of up to %(limit)s characters.') % {'limit': limit},
        message_key='post_share_links.invalid_label',
        message_params={'limit': limit},
    )


@never_cache
@require_http_methods(['GET', 'POST'])
@api_editor_required_methods(['GET', 'POST'])
def post_share_links(request: HttpRequest, username: str, url: str) -> HttpResponse:
    post = get_object_or_404(PostShareLinkService.managed_posts(request.user, username), url=url)
    can_create = PostShareLinkService.can_create(post)
    if request.method == 'GET':
        return StatusDone({
            'links': PostShareLinkService.summaries(post, request),
            'can_create': can_create,
        })

    if not can_create:
        return StatusError(
            ErrorCode.REJECT,
            gettext('Share links can only be created for public posts.'),
            message_key='post_share_links.public_post_required',
        )

    body, error = ApiRequestBodyService.parse_json_or_error(request, require_body=True)
    if error:
        return error
    if body.keys() - {'label'}:
        return StatusError(ErrorCode.VALIDATE, gettext('Invalid request.'))
    label = PostShareLinkService.clean_label(body.get('label'))
    if label is None:
        return invalid_label_response()
    link = PostShareLinkService.create(post, label)
    return StatusDone({'id': link.pk})


@never_cache
@require_http_methods(['PATCH'])
@api_editor_required_methods(['PATCH'])
def post_share_link_detail(request: HttpRequest, username: str, url: str, link_id: int) -> HttpResponse:
    post = get_object_or_404(PostShareLinkService.managed_posts(request.user, username), url=url)
    link = get_object_or_404(post.share_links, pk=link_id)
    body, error = ApiRequestBodyService.parse_json_or_error(request, require_body=True)
    if error:
        return error

    if not body or body.keys() - {'label', 'is_paused'}:
        return StatusError(ErrorCode.VALIDATE, gettext('Invalid request.'))
    label = PostShareLinkService.clean_label(body['label']) if 'label' in body else None
    if 'label' in body and label is None:
        return invalid_label_response()
    is_paused = body.get('is_paused')
    if 'is_paused' in body and not isinstance(is_paused, bool):
        return StatusError(ErrorCode.VALIDATE, gettext('Invalid request.'))

    PostShareLinkService.update(link, label=label, is_paused=is_paused)
    return StatusDone()
