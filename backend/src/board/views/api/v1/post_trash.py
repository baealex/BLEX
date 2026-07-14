from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404

from board.decorators import api_editor_required_methods
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.post_trash_service import (
    PostTrashConflictError,
    PostTrashError,
    PostTrashService,
)


@api_editor_required_methods(['GET', 'DELETE'])
def trashed_posts(
    request: HttpRequest,
    url: str | None = None,
) -> HttpResponse:
    if request.method == 'GET' and url is None:
        try:
            page = int(request.GET.get('page', 1))
        except (TypeError, ValueError):
            page = 0

        if page < 1:
            return StatusError(
                ErrorCode.VALIDATE,
                '휴지통 페이지 정보를 확인해주세요.',
            )

        try:
            trash_page = PostTrashService.get_page(request.user, page)
        except PostTrashError as error:
            return StatusError(ErrorCode.VALIDATE, str(error))

        return StatusDone({
            'posts': trash_page.posts,
            'pagination': {
                'page': trash_page.page,
                'total_count': trash_page.total_count,
                'last_page': trash_page.last_page,
            },
            'retention': {
                'mode': 'manual',
            },
        })

    if request.method == 'DELETE' and url is not None:
        expected_deleted_date = request.GET.get('expectedDeletedDate', '')
        if not expected_deleted_date:
            return StatusError(
                ErrorCode.VALIDATE,
                '현재 휴지통 상태를 확인해주세요.',
            )

        post = get_object_or_404(
            PostTrashService.get_user_trash(request.user),
            url=url,
        )
        try:
            post_id = PostTrashService.purge_post(
                post,
                expected_deleted_date=expected_deleted_date,
            )
        except PostTrashConflictError as error:
            return StatusError(ErrorCode.REJECT, str(error))
        except PostTrashError as error:
            return StatusError(ErrorCode.REJECT, str(error))

        return StatusDone({
            'deleted': True,
            'id': post_id,
        })

    raise Http404


@api_editor_required_methods(['POST'])
def restore_trashed_post(
    request: HttpRequest,
    url: str,
) -> HttpResponse:
    if request.method != 'POST':
        raise Http404

    body, body_error = ApiRequestBodyService.parse_json_or_error(
        request,
        require_body=True,
    )
    if body_error:
        return body_error

    expected_deleted_date = (
        body.get('expected_deleted_date')
        or body.get('expectedDeletedDate')
    )
    if not isinstance(expected_deleted_date, str) or not expected_deleted_date:
        return StatusError(
            ErrorCode.VALIDATE,
            '현재 휴지통 상태를 확인해주세요.',
        )

    post = get_object_or_404(
        PostTrashService.get_user_trash(request.user),
        url=url,
    )
    try:
        post = PostTrashService.restore_post(
            post,
            expected_deleted_date=expected_deleted_date,
        )
    except PostTrashConflictError as error:
        return StatusError(ErrorCode.REJECT, str(error))
    except PostTrashError as error:
        return StatusError(ErrorCode.REJECT, str(error))

    return StatusDone({
        'url': post.url,
        'status': PostTrashService.current_status(post),
        'restored': True,
    })
