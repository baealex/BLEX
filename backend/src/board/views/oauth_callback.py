from django.shortcuts import render, redirect
from django.http import Http404
from django.contrib import messages
from django.conf import settings

from modules import oauth
from board.views.api.v1.auth import common_auth, create_user
from board.models import User, UserLinkMeta


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
                return common_auth(request, users.first())

            user, profile, config = create_user(
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

            return common_auth(request, user)

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
                return common_auth(request, users.first())

            user, profile, config = create_user(
                username=user_id,
                name=name,
                email=email,
                avatar_url=avatar_url,
                token=token,
            )

            return common_auth(request, user)

    except Exception as e:
        messages.error(request, f'{provider.title()} 로그인 중 오류가 발생했습니다.')
        return redirect('login')

    raise Http404