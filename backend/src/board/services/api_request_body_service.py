import json

from django.http import QueryDict

from board.modules.response import ErrorCode, StatusError


class ApiRequestBodyService:
    """Helpers for parsing API request bodies consistently."""

    DEFAULT_INVALID_JSON_MESSAGE = '잘못된 요청입니다.'

    @staticmethod
    def parse_json(request, default=None):
        """Return the JSON object in the request body, or default for an empty body.

        JSONDecodeError and UnicodeDecodeError are intentionally allowed to bubble
        so callers can preserve endpoint-specific error behavior where needed.
        """
        if not request.body:
            return {} if default is None else default

        return json.loads(request.body.decode('utf-8'))

    @staticmethod
    def parse_json_or_error(
        request,
        default=None,
        message=None,
        error_code=ErrorCode.VALIDATE,
        require_body=False,
    ):
        """Parse JSON and return (data, error_response)."""
        if require_body and not request.body:
            return None, StatusError(
                error_code,
                message or ApiRequestBodyService.DEFAULT_INVALID_JSON_MESSAGE,
            )

        try:
            return ApiRequestBodyService.parse_json(request, default=default), None
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, StatusError(
                error_code,
                message or ApiRequestBodyService.DEFAULT_INVALID_JSON_MESSAGE,
            )

    @staticmethod
    def parse_json_or_empty_for_legacy_only(request):
        """Parse JSON, swallowing invalid bodies only for legacy update endpoints.

        Prefer parse_json_or_error() for all new mutation endpoints. This helper
        exists to preserve old partial-update behavior where invalid JSON is
        treated as an empty payload and existing fields remain unchanged.
        """
        try:
            return ApiRequestBodyService.parse_json(request)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    @staticmethod
    def parse_json_or_querydict(request):
        """Parse JSON, falling back to QueryDict for form-encoded bodies."""
        try:
            return ApiRequestBodyService.parse_json(request)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return QueryDict(request.body)
