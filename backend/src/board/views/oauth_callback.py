import json

from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib import messages, auth
from django.conf import settings

from modules import oauth
from board.services.auth_service import AuthService, OAuthService
from board.services.initial_setup_service import InitialSetupService
from board.services.social_auth_provider_service import SocialAuthProviderService
from board.models import SocialAuth, UserLinkMeta


def handle_oauth_auth(request, user):
    """
    Handle OAuth authentication with 2FA support
    """
    next_url = request.GET.get('next', '')

    if not settings.DEBUG and user.config.has_two_factor_auth():
        oauth_token = OAuthService.create_2fa_token(user.id, next_url)

        messages.info(request, '2차 인증이 필요합니다. 인증 앱에서 생성된 코드를 입력해주세요.')

        redirect_url = f'/login?oauth_token={oauth_token}'
        if next_url:
            redirect_url += f'&next={next_url}'
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

    if not SocialAuthProviderService.is_enabled(provider):
        messages.error(request, '소셜 로그인이 설정되지 않았습니다. 관리자에게 문의해주세요.')
        return redirect('login')
    
    code = request.GET.get('code')
    if not code:
        messages.error(request, '소셜 로그인에 실패했습니다. 다시 시도해주세요.')
        return redirect('login')
    
    try:
        if provider == 'github':
            state = oauth.auth_github(code)
            if not state.success:
                messages.error(request, 'GitHub 로그인에 실패했습니다.')
                return redirect('login')

            avatar_url = state.user.get('avatar_url')
            node_id = state.user.get('node_id')
            user_id = state.user.get('login')
            name = state.user.get('name')
            social_provider = SocialAuthProviderService.get_provider(provider)
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
                messages.error(request, 'Google 로그인에 실패했습니다.')
                return redirect('login')

            avatar_url = state.user.get('picture')
            node_id = state.user.get('id')
            user_id = state.user.get('email').split('@')[0]
            email = state.user.get('email')
            name = state.user.get('name')
            social_provider = SocialAuthProviderService.get_provider(provider)
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
        messages.error(request, f'{provider.title()} 로그인 중 오류가 발생했습니다.')
        return redirect('login')

    raise Http404
