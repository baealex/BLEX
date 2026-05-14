import json

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
    def parse_json_or_error(request, default=None, message=None):
        """Parse JSON and return (data, error_response)."""
        try:
            return ApiRequestBodyService.parse_json(request, default=default), None
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, StatusError(
                ErrorCode.VALIDATE,
                message or ApiRequestBodyService.DEFAULT_INVALID_JSON_MESSAGE,
            )

    @staticmethod
    def parse_json_or_default(request, default=None):
        """Parse JSON, falling back to default when the body is invalid."""
        try:
            return ApiRequestBodyService.parse_json(request, default=default)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {} if default is None else default
