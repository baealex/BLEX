import json


class AuthRequestParser:
    """Parse legacy auth request bodies without changing fallback behavior."""

    @staticmethod
    def parse_login_request(request) -> dict:
        try:
            return json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}
