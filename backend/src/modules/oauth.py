import requests

from django.conf import settings

def auth_google(code):
    data = {
        'code': code,
        'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH_CLIENT_SECRET,
        'redirect_uri': settings.SITE_URL + '/login/callback/google',
        'grant_type': 'authorization_code',
    }
    response = requests.post(
        'https://accounts.google.com/o/oauth2/token', data=data
    )
    if response.status_code == 200:
        params = {
            'access_token': response.json().get('access_token')
        }
        response = requests.get(
            'https://www.googleapis.com/oauth2/v1/userinfo', params=params
        )
        try:
            return {'status': True, 'user': response.json()}
        except:
            pass
    return {'status': False}

def auth_github(code):
    data = {
        'code': code,
        'client_id': settings.GITHUB_OAUTH_CLIENT_ID,
        'client_secret': settings.GITHUB_OAUTH_CLIENT_SECRET
    }
    headers = {'Accept': 'application/json'}
    response = requests.post(
        'https://github.com/login/oauth/access_token', headers=headers, data=data
    )
    if response.status_code == 200:
        access_token = response.json().get('access_token')
        headers = {'Authorization': 'token ' + str(access_token)}
        response = requests.get(
            'https://api.github.com/user', headers=headers
        )
        try:
            return {'status': True, 'user': response.json()}
        except:
            pass
    return {'status': False}