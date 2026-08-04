import logging

from django.db import transaction
from django.utils.translation import gettext as _

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.utility_cleanup_audit_service import UtilityCleanupAuditService
from board.services.utility_cleanup_confirmation_service import (
    InvalidUtilityCleanupConfirmationError,
    UtilityCleanupConfirmationService,
)
from board.services.utility_cleanup_service import (
    InvalidImageCleanupTargetError,
    UtilityCleanupService,
    UtilityPermissionService,
)


logger = logging.getLogger(__name__)


def _session_key(request) -> str:
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key


def _run_cleanup(request, body: dict, *, action: str, cleanup):
    try:
        parameters = UtilityCleanupService.confirmation_parameters(action, body)
    except InvalidImageCleanupTargetError:
        return StatusError(ErrorCode.VALIDATE, _('Select a valid cleanup target.'))

    session_key = _session_key(request)
    if UtilityCleanupService.is_dry_run(body):
        result = cleanup(body)
        result['confirmation_token'] = UtilityCleanupConfirmationService.issue(
            user_id=request.user.pk,
            session_key=session_key,
            action=action,
            parameters=parameters,
        )
        return StatusDone(result)

    try:
        confirmation_token_hash = UtilityCleanupConfirmationService.require_valid(
            token=body.get('confirmation_token'),
            user_id=request.user.pk,
            session_key=session_key,
            action=action,
            parameters=parameters,
        )
    except InvalidUtilityCleanupConfirmationError:
        return StatusError(
            ErrorCode.REJECT,
            _('The cleanup preview has expired or is invalid.'),
        )

    if action == UtilityCleanupService.ACTION_CLEAN_IMAGES:
        # Filesystem deletion cannot participate in a DB rollback. Persist the
        # redacted intent first so an audit write failure never follows deletion.
        try:
            with transaction.atomic():
                UtilityCleanupConfirmationService.consume(
                    token_hash=confirmation_token_hash,
                    user_id=request.user.pk,
                    session_key=session_key,
                    action=action,
                )
                audit_entry = UtilityCleanupAuditService.record_intent(
                    user=request.user,
                    action=action,
                )
        except InvalidUtilityCleanupConfirmationError:
            return StatusError(
                ErrorCode.REJECT,
                _('The cleanup preview has expired or is invalid.'),
            )
        result = cleanup(body)
        try:
            UtilityCleanupAuditService.mark_completed(
                audit_entry=audit_entry,
                action=action,
            )
        except Exception:
            # The persisted intent remains the forensic record if completion
            # labeling is unavailable after an irreversible filesystem action.
            logger.exception('Failed to mark utility image cleanup as completed.')
        return StatusDone(result)

    try:
        with transaction.atomic():
            UtilityCleanupConfirmationService.consume(
                token_hash=confirmation_token_hash,
                user_id=request.user.pk,
                session_key=session_key,
                action=action,
            )
            result = cleanup(body)
            UtilityCleanupAuditService.record_execution(
                user=request.user,
                action=action,
            )
    except InvalidUtilityCleanupConfirmationError:
        return StatusError(
            ErrorCode.REJECT,
            _('The cleanup preview has expired or is invalid.'),
        )

    return StatusDone(result)


def utility_stats(request):
    """
    GET /v1/utilities/stats - DB 통계 + 로그 수 반환
    """
    permission_error = UtilityPermissionService.require_superuser(request.user)
    if permission_error:
        return permission_error

    if request.method != 'GET':
        return StatusError(ErrorCode.REJECT)

    return StatusDone(UtilityCleanupService.get_stats())


def utility_clean_tags(request):
    """
    POST /v1/utilities/clean-tags - 태그 정리
    Body: { dry_run: bool, confirmation_token?: str }
    """
    permission_error = UtilityPermissionService.require_superuser(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return _run_cleanup(
        request,
        body,
        action=UtilityCleanupService.ACTION_CLEAN_TAGS,
        cleanup=UtilityCleanupService.clean_tags,
    )


def utility_clean_sessions(request):
    """
    POST /v1/utilities/clean-sessions - 세션 정리
    Body: { dry_run: bool, clean_all: bool, confirmation_token?: str }
    """
    permission_error = UtilityPermissionService.require_superuser(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return _run_cleanup(
        request,
        body,
        action=UtilityCleanupService.ACTION_CLEAN_SESSIONS,
        cleanup=UtilityCleanupService.clean_sessions,
    )


def utility_clean_logs(request):
    """
    POST /v1/utilities/clean-logs - 로그 정리
    Body: { dry_run: bool, confirmation_token?: str }
    """
    permission_error = UtilityPermissionService.require_superuser(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return _run_cleanup(
        request,
        body,
        action=UtilityCleanupService.ACTION_CLEAN_LOGS,
        cleanup=UtilityCleanupService.clean_logs,
    )


def utility_clean_images(request):
    """
    POST /v1/utilities/clean-images - 이미지 정리
    Body: { dry_run: bool, target: str, remove_duplicates: bool, confirmation_token?: str }
    """
    permission_error = UtilityPermissionService.require_superuser(request.user)
    if permission_error:
        return permission_error

    if request.method != 'POST':
        return StatusError(ErrorCode.REJECT)

    body, body_error = ApiRequestBodyService.parse_json_or_error(request)
    if body_error:
        return body_error

    return _run_cleanup(
        request,
        body,
        action=UtilityCleanupService.ACTION_CLEAN_IMAGES,
        cleanup=UtilityCleanupService.clean_images,
    )
