import json
from urllib.parse import urlencode

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib import messages, auth
from django.conf import settings
from django.utils.translation import gettext

from modules import oauth
from board.services.auth_service import AuthService, OAuthService
from board.services.initial_setup_service import InitialSetupService
from board.services.social_auth_provider_service import SocialAuthProviderService
from board.models import SocialAuth, UserLinkMeta
from board.views.auth import get_safe_redirect_url


def handle_oauth_auth(request, user):
    """
    Handle OAuth authentication with 2FA support
    """
    next_url = get_safe_redirect_url(request) or ''

    if not settings.DEBUG and user.config.has_two_factor_auth():
        oauth_token = OAuthService.create_2fa_token(user.id, next_url)

        messages.info(
            request,
            gettext(
                'Two-factor authentication is required. Enter the code from '
                'your authenticator app.'
            ),
        )

        redirect_params = {'oauth_token': oauth_token}
        if next_url:
            redirect_params['next'] = next_url
        redirect_url = f'/login?{urlencode(redirect_params)}'
        return redirect(redirect_url)

    auth.login(request, user)
    return redirect(next_url or '/')


def oauth_callback(request, provider):
    """
    Handle OAuth callback from social providers
    """
    if provider not in ['google', 'github']:
        raise Http404('Unsupported provider')

    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('/setup')

    social_provider = SocialAuthProviderService.get_enabled_provider(provider)
    if social_provider is None:
        messages.error(
            request,
            gettext(
                'Social login is not configured. Please contact the administrator.'
            ),
        )
        return redirect('login')
    
    code = request.GET.get('code')
    if not code:
        messages.error(request, gettext('Social login failed. Please try again.'))
        return redirect('login')
    
    try:
        if provider == 'github':
            state = oauth.auth_github(code)
            if not state.success:
                messages.error(request, gettext('GitHub login failed.'))
                return redirect('login')

            avatar_url = state.user.get('avatar_url')
            node_id = state.user.get('node_id')
            user_id = state.user.get('login')
            name = state.user.get('name')
            social_auth = SocialAuth.objects.filter(provider=social_provider, uid=node_id).select_related('user').first()
            if social_auth:
                return handle_oauth_auth(request, social_auth.user)

            user, _, _ = AuthService.create_user(
                username=user_id,
                name=name,
                email='',
                avatar_url=avatar_url,
            )
            SocialAuth.objects.create(
                user=user,
                provider=social_provider,
                uid=node_id,
                extra_data=json.dumps(state.user, ensure_ascii=False),
            )

            UserLinkMeta.objects.create(
                user=user,
                name='github',
                value=f'https://github.com/{user_id}'
            )

            return handle_oauth_auth(request, user)

        elif provider == 'google':
            state = oauth.auth_google(code)
            if not state.success:
                messages.error(request, gettext('Google login failed.'))
                return redirect('login')

            avatar_url = state.user.get('picture')
            node_id = state.user.get('id')
            user_id = state.user.get('email').split('@')[0]
            email = state.user.get('email')
            name = state.user.get('name')
            social_auth = SocialAuth.objects.filter(provider=social_provider, uid=node_id).select_related('user').first()
            if social_auth:
                return handle_oauth_auth(request, social_auth.user)

            user, _, _ = AuthService.create_user(
                username=user_id,
                name=name,
                email=email,
                avatar_url=avatar_url,
            )
            SocialAuth.objects.create(
                user=user,
                provider=social_provider,
                uid=node_id,
                extra_data=json.dumps(state.user, ensure_ascii=False),
            )

            return handle_oauth_auth(request, user)

    except Exception:
        messages.error(
            request,
            gettext('An error occurred while logging in with %(provider)s.') % {
                'provider': provider.title(),
            },
        )
        return redirect('login')

    raise Http404
