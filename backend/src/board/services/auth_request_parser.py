from board.services.api_request_body_service import ApiRequestBodyService


class AuthRequestParser:
    """Parse legacy auth request bodies without changing fallback behavior."""

    @staticmethod
    def parse_login_request(request) -> dict:
        return ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
