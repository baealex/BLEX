from math import ceil

from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404

from board.decorators import api_editor_required_methods
from board.models import EditHistory, Post
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.post_revision_service import (
    PostRevisionConflictError,
    PostRevisionRestoreError,
    PostRevisionService,
)
from board.services.post_service import PostService


def _get_editable_revision_post(
    request: HttpRequest,
    username: str,
    url: str,
) -> Post:
    post = get_object_or_404(
        Post.objects.select_related('author'),
        author__username=username,
        url=url,
        published_date__isnull=False,
    )
    if not PostService.can_user_edit_post(request.user, post):
        raise Http404
    return post


def _positive_integer(value: str | None, default: int) -> int | None:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


@api_editor_required_methods(['GET', 'DELETE'])
def post_revisions(
    request: HttpRequest,
    username: str,
    url: str,
    revision_id: int | None = None,
) -> HttpResponse:
    if request.method not in {'GET', 'DELETE'}:
        raise Http404

    post = _get_editable_revision_post(request, username, url)
    revisions = (
        EditHistory.objects.filter(post=post)
        .select_related('actor')
        .order_by('-created_date', '-id')
    )

    if revision_id is not None:
        revision = get_object_or_404(revisions, pk=revision_id)
        if request.method == 'DELETE':
            try:
                deleted_revision_id = PostRevisionService.delete_revision(
                    post,
                    revision,
                )
            except EditHistory.DoesNotExist as error:
                raise Http404 from error
            return StatusDone({
                'revision_id': deleted_revision_id,
                'deleted': True,
            })
        return StatusDone({
            'revision': PostRevisionService.serialize_detail(revision),
        })

    if request.method == 'DELETE':
        raise Http404

    page = _positive_integer(request.GET.get('page'), 1)
    limit = _positive_integer(
        request.GET.get('limit'),
        PostRevisionService.PAGE_SIZE,
    )
    if page is None or limit is None or limit > PostRevisionService.MAX_PAGE_SIZE:
        return StatusError(
            ErrorCode.VALIDATE,
            '수정 이력 페이지 정보를 확인해주세요.',
        )

    total_count = revisions.count()
    last_page = max(1, ceil(total_count / limit))
    if page > last_page:
        return StatusError(
            ErrorCode.VALIDATE,
            '수정 이력 페이지 정보를 확인해주세요.',
        )

    start = (page - 1) * limit
    page_revisions = revisions[start:start + limit]
    return StatusDone({
        'revisions': [
            PostRevisionService.serialize_summary(revision)
            for revision in page_revisions
        ],
        'pagination': {
            'page': page,
            'limit': limit,
            'total_count': total_count,
            'last_page': last_page,
        },
        'current_updated_date': post.updated_date.isoformat(),
        'retention': {
            'mode': 'unlimited',
        },
    })


@api_editor_required_methods(['POST'])
def restore_post_revision(
    request: HttpRequest,
    username: str,
    url: str,
    revision_id: int,
) -> HttpResponse:
    if request.method != 'POST':
        raise Http404

    post = _get_editable_revision_post(request, username, url)
    revision = get_object_or_404(
        EditHistory.objects.select_related('actor'),
        post=post,
        pk=revision_id,
    )
    body, body_error = ApiRequestBodyService.parse_json_or_error(
        request,
        require_body=True,
    )
    if body_error:
        return body_error

    expected_updated_date = (
        body.get('expected_updated_date')
        or body.get('expectedUpdatedDate')
    )
    if not isinstance(expected_updated_date, str) or not expected_updated_date:
        return StatusError(
            ErrorCode.VALIDATE,
            '현재 포스트 버전을 확인해주세요.',
        )

    try:
        post, restored = PostRevisionService.restore_revision(
            post,
            revision,
            actor=request.user,
            expected_updated_date=expected_updated_date,
        )
    except PostRevisionConflictError as error:
        return StatusError(ErrorCode.REJECT, str(error))
    except PostRevisionRestoreError as error:
        return StatusError(ErrorCode.REJECT, str(error))

    return StatusDone({
        'url': post.url,
        'updated_date': post.updated_date.isoformat(),
        'restored': restored,
    })
