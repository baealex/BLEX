from django.contrib.auth.models import User
from django.http import Http404

from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.user_management_service import UserManagementError, UserManagementService


def managed_users(request):
    """
    Staff-only user management API.

    GET /v1/admin/users - List users
    PATCH /v1/admin/users/<id>/role - Update a user's reader/editor role
    """
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method == 'GET':
        query = request.GET.get('q', '').strip()
        return StatusDone(UserManagementService.list_users(
            query=query,
            role=request.GET.get('role', 'all'),
            ordering=request.GET.get('ordering', 'username'),
            page=request.GET.get('page', 1),
            page_size=request.GET.get('page_size', UserManagementService.DEFAULT_PAGE_SIZE),
        ))

    raise Http404


def managed_user_role(request, user_id):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'PATCH':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request, require_body=True)
    if body_error:
        return body_error

    try:
        user = UserManagementService.update_role(request.user, user_id, body.get('role'))
        return StatusDone({'user': user})
    except User.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.')
    except UserManagementError as error:
        return StatusError(ErrorCode.REJECT, error.message)
