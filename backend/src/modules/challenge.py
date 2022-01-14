import requests

from django.conf import settings

def auth_hcaptcha(response):
    data = {
        'response': response,
        'secret': settings.HCAPTCHA_SECRET_KEY
    }
    response = requests.post('https://hcaptcha.com/siteverify', data=data)
    if response.json().get('success'):
        return True
    return False