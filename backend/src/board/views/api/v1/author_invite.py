from django.http import Http404

from board.models import AuthorInvite
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.author_invite_service import AuthorInviteError, AuthorInviteService


def author_invites(request):
    """Staff-only author invite API."""
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method == 'GET':
        return StatusDone({'invites': AuthorInviteService.list_invites()})

    if request.method == 'POST':
        body, body_error = ApiRequestBodyService.parse_json_or_error(request, default={})
        if body_error:
            return body_error

        invite = AuthorInviteService.create_invite(
            created_by=request.user,
            note=body.get('note', ''),
        )
        return StatusDone({'invite': AuthorInviteService.serialize_invite(invite)})

    raise Http404


def author_invite_detail(request, invite_id: int):
    """Staff-only author invite detail API."""
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method == 'DELETE':
        try:
            AuthorInviteService.delete_invite(invite_id)
        except AuthorInvite.DoesNotExist:
            return StatusError(ErrorCode.NOT_FOUND, '초대 링크를 찾을 수 없습니다.')
        except AuthorInviteError as error:
            return StatusError(ErrorCode.REJECT, error.message)

        return StatusDone()

    raise Http404
