from base64 import urlsafe_b64encode
from datetime import timedelta
from hashlib import sha256
from secrets import token_urlsafe
from urllib.parse import urlencode

from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import constant_time_compare

from board.models import OAuthAuthorization
from board.services.regional_preferences_service import RegionalPreferencesService
from board.services.social_auth_provider_service import SocialAuthProviderService


class OAuthFlowService:
    SESSION_KEY = 'oauth_authorizations'
    VALIDITY_SECONDS = 600
    PROVIDERS = {
        'google': ('https://accounts.google.com/o/oauth2/v2/auth', 'openid email profile'),
        'github': ('https://github.com/login/oauth/authorize', 'user:email'),
    }

    @classmethod
    def start(cls, request: HttpRequest, provider: str, next_url: str, reauthenticate: bool = False) -> str:
        client_id, client_secret = SocialAuthProviderService.get_credentials(provider)
        if not client_id or not client_secret or provider not in cls.PROVIDERS:
            return ''

        authorize_url, scope = cls.PROVIDERS[provider]
        state = token_urlsafe(32)
        verifier = token_urlsafe(48)
        challenge = urlsafe_b64encode(sha256(verifier.encode()).digest()).decode().rstrip('=')
        redirect_uri = request.build_absolute_uri(reverse('oauth_callback', args=[provider]))
        now = timezone.now()
        OAuthAuthorization.objects.filter(expires_at__lte=now).delete()
        OAuthAuthorization.objects.create(
            state_hash=sha256(state.encode()).hexdigest(),
            expires_at=now + timedelta(seconds=cls.VALIDITY_SECONDS),
        )
        flows = request.session.get(cls.SESSION_KEY, {})
        flows[provider] = {
            'state': state,
            'verifier': verifier,
            'redirect_uri': redirect_uri,
            'next_url': next_url,
            'user_id': request.user.pk if reauthenticate else None,
        }
        if not reauthenticate:
            language, time_zone = RegionalPreferencesService.normalize(
                request.LANGUAGE_CODE, request.GET.get('time_zone'),
            )
            flows[provider].update(language=language, time_zone=time_zone)
        request.session[cls.SESSION_KEY] = flows

        parameters = {
            'client_id': client_id,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': scope,
            'state': state,
            'code_challenge': challenge,
            'code_challenge_method': 'S256',
        }
        if reauthenticate:
            parameters['prompt'] = 'select_account'
        return f'{authorize_url}?{urlencode(parameters)}'

    @classmethod
    def consume(cls, request: HttpRequest, provider: str, state: str) -> dict | None:
        flows = request.session.get(cls.SESSION_KEY, {})
        flow = flows.get(provider)
        if not flow or not constant_time_compare(state, flow['state']):
            return None
        if flow['user_id'] != request.user.pk:
            return None
        consumed, _ = OAuthAuthorization.objects.filter(
            state_hash=sha256(state.encode()).hexdigest(), expires_at__gt=timezone.now(),
        ).delete()
        if not consumed:
            return None
        del flows[provider]
        request.session[cls.SESSION_KEY] = flows
        return flow
