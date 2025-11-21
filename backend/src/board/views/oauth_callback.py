from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib import messages, auth
from django.conf import settings

from modules import oauth
from board.services.auth_service import AuthService
from board.models import User, UserLinkMeta
from modules.randomness import randnum
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot


def handle_oauth_auth(request, user):
    """
    Handle OAuth authentication with 2FA support
    """
    # Get next URL from query string
    next_url = request.GET.get('next', '')

    # Check if 2FA is required
    if not settings.DEBUG and user.config.has_two_factor_auth():
        # Create and send 2FA token
        def create_auth_token():
            token = randnum(6)
            user.twofactorauth.create_token(token)
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            bot.send_message(user.telegramsync.get_decrypted_tid(),
                            f'2차 인증 코드입니다 : {token}')

        SubTaskProcessor.process(create_auth_token)
        # Store user info in session for 2FA completion
        request.session['pending_2fa_user_id'] = user.id
        request.session['pending_2fa_username'] = user.username
        # Store next URL in session for after 2FA
        if next_url:
            request.session['auth_next_url'] = next_url
        messages.info(request, '2차 인증이 필요합니다. 텔레그램으로 전송된 코드를 입력해주세요.')
        return redirect(f'/login{("?next=" + next_url) if next_url else ""}')

    # No 2FA required, login directly
    auth.login(request, user)
    return redirect(next_url or '/')


def oauth_callback(request, provider):
    """
    Handle OAuth callback from social providers
    """
    if provider not in ['google', 'github']:
        raise Http404('Unsupported provider')
    
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
            token = f'{provider}:{node_id}'

            users = User.objects.filter(last_name=token)
            if users.exists():
                return handle_oauth_auth(request, users.first())

            user, _, _ = AuthService.create_user(
                username=user_id,
                name=name,
                email='',
                avatar_url=avatar_url,
                token=token,
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
            token = f'{provider}:{node_id}'

            users = User.objects.filter(last_name=token)
            if users.exists():
                return handle_oauth_auth(request, users.first())

            user, _, _ = AuthService.create_user(
                username=user_id,
                name=name,
                email=email,
                avatar_url=avatar_url,
                token=token,
            )

            return handle_oauth_auth(request, user)

    except Exception:
        messages.error(request, f'{provider.title()} 로그인 중 오류가 발생했습니다.')
        return redirect('login')

    raise Http404
