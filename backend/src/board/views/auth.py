from django.shortcuts import render, redirect
from urllib.parse import unquote, urlparse
from django.utils.http import url_has_allowed_host_and_scheme

from board.services.hcaptcha_service import HCaptchaService
from board.services.initial_setup_service import InitialSetupService


def get_safe_redirect_url(request):
    """
    Get and validate the 'next' parameter from request.
    Returns the safe redirect URL or None if invalid.
    Prevents open redirect vulnerabilities by only allowing same-domain URLs.
    """
    next_url = request.GET.get('next', '').strip()

    if not next_url:
        return None

    if not url_has_allowed_host_and_scheme(
        next_url,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return None

    parsed = urlparse(next_url)
    path = parsed.path or '/'
    decoded_path = unquote(path)
    if (
        not path.startswith('/')
        or path.startswith('//')
        or '\\' in path
        or decoded_path.startswith('//')
        or '\\' in decoded_path
    ):
        return None

    return path


def login_view(request):
    """
    Login page view that renders the login template.
    If user is already authenticated, redirects to the 'next' URL or home page.
    """
    next_url = get_safe_redirect_url(request)

    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('/setup')

    if request.user.is_authenticated:
        return redirect(next_url or '/')

    display_next_url = next_url or request.session.get('auth_next_url', '')

    context = {
        'HCAPTCHA_SITE_KEY': HCaptchaService.get_site_key(),
        'show_2fa': 'pending_2fa_user_id' in request.session,
        'username': request.session.get('pending_2fa_username', ''),
        'next_url': display_next_url,
    }

    return render(request, 'board/auth/login.html', context)


def signup_view(request):
    """
    Signup page view that renders the signup template.
    If user is already authenticated, redirects to the 'next' URL or home page.
    """
    next_url = get_safe_redirect_url(request)

    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('/setup')

    if request.user.is_authenticated:
        return redirect(next_url or '/')

    context = {
        'HCAPTCHA_SITE_KEY': HCaptchaService.get_site_key(),
        'next_url': next_url or '',
        'invite_code': request.GET.get('invite', '').strip(),
    }

    return render(request, 'board/auth/signup.html', context)
