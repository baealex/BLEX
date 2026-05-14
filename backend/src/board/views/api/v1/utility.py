from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.utility_cleanup_service import (
    InvalidImageCleanupTargetError,
    UtilityCleanupService,
    UtilityPermissionService,
)


def utility_stats(request):
    """
    GET /v1/utilities/stats - DB 통계 + 로그 수 반환
    """
    permission_error = UtilityPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'GET':
        return StatusError(ErrorCode.REJECT)

    return StatusDone(UtilityCleanupService.get_stats())


def utility_clean_tags(request):
    """
    POST /v1/utilities/clean-tags - 태그 정리
    Body: { dry_run: bool }
    """
    permission_error = UtilityPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return StatusDone(UtilityCleanupService.clean_tags(body))


def utility_clean_sessions(request):
    """
    POST /v1/utilities/clean-sessions - 세션 정리
    Body: { dry_run: bool, clean_all: bool }
    """
    permission_error = UtilityPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return StatusDone(UtilityCleanupService.clean_sessions(body))


def utility_clean_logs(request):
    """
    POST /v1/utilities/clean-logs - 로그 정리
    Body: { dry_run: bool }
    """
    permission_error = UtilityPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return StatusDone(UtilityCleanupService.clean_logs(body))


def utility_clean_images(request):
    """
    POST /v1/utilities/clean-images - 이미지 정리
    Body: { dry_run: bool, target: str, remove_duplicates: bool }
    """
    permission_error = UtilityPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    try:
        return StatusDone(UtilityCleanupService.clean_images(body))
    except InvalidImageCleanupTargetError:
        return StatusError(ErrorCode.VALIDATE, '유효하지 않은 대상입니다.')
