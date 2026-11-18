from dataclasses import dataclass, field

import requests

from board.services.social_auth_provider_service import SocialAuthProviderService


@dataclass
class State:
    success: bool
    user: dict = field(default_factory=dict)


def exchange_oauth_code(
    provider: str, token_url: str, user_url: str, code: str, verifier: str, redirect_uri: str,
) -> State:
    client_id, client_secret = SocialAuthProviderService.get_credentials(provider)
    if not client_id or not client_secret:
        return State(success=False)

    try:
        response = requests.post(
            token_url,
            headers={'Accept': 'application/json'},
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'code': code,
                'redirect_uri': redirect_uri,
                'code_verifier': verifier,
                'grant_type': 'authorization_code',
            },
            timeout=10,
        )
        response.raise_for_status()
        access_token = response.json().get('access_token')
        if not access_token:
            return State(success=False)

        response = requests.get(
            user_url, headers={'Authorization': f'Bearer {access_token}'}, timeout=10,
        )
        response.raise_for_status()
        user = response.json()
        if isinstance(user, dict):
            return State(success=True, user=user)
    except (requests.RequestException, ValueError, AttributeError):
        pass
    return State(success=False)


def auth_google(code: str, verifier: str, redirect_uri: str) -> State:
    return exchange_oauth_code(
        'google', 'https://oauth2.googleapis.com/token', 'https://www.googleapis.com/oauth2/v1/userinfo',
        code, verifier, redirect_uri,
    )


def auth_github(code: str, verifier: str, redirect_uri: str) -> State:
    return exchange_oauth_code(
        'github', 'https://github.com/login/oauth/access_token', 'https://api.github.com/user',
        code, verifier, redirect_uri,
    )
