import requests

from board.services.site_url_service import SiteUrlService
from board.services.social_auth_provider_service import SocialAuthProviderService


class State:
    def __init__(self, success, user=None):
        self.success = success
        self.user = user or {}


def auth_google(code) -> State:
    data = {
        'code': code,
        'client_id': SocialAuthProviderService.get_client_id('google'),
        'client_secret': SocialAuthProviderService.get_client_secret('google'),
        'redirect_uri': SiteUrlService.configured_absolute_url('/login/callback/google'),
        'grant_type': 'authorization_code',
    }
    if not data['client_id'] or not data['client_secret']:
        return State(success=False, user={})

    response = requests.post(
        'https://accounts.google.com/o/oauth2/token',
        data=data
    )
    if response.status_code == 200:
        params = {
            'access_token': response.json().get('access_token')
        }
        response = requests.get(
            'https://www.googleapis.com/oauth2/v1/userinfo',
            params=params
        )
        return State(success=True, user=response.json())

    return State(success=False)


def auth_github(code) -> State:
    data = {
        'code': code,
        'client_id': SocialAuthProviderService.get_client_id('github'),
        'client_secret': SocialAuthProviderService.get_client_secret('github')
    }
    if not data['client_id'] or not data['client_secret']:
        return State(success=False, user={})

    headers = {
        'Accept': 'application/json'
    }
    response = requests.post(
        'https://github.com/login/oauth/access_token',
        headers=headers,
        data=data
    )

    if response.status_code == 200:
        access_token = response.json().get('access_token')
        headers = {
            'Authorization': 'token ' + str(access_token)
        }
        response = requests.get(
            'https://api.github.com/user',
            headers=headers
        )
        return State(success=True, user=response.json())

    return State(success=False)
