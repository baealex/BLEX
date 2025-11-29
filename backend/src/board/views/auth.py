from django.shortcuts import render, redirect
from django.conf import settings
from urllib.parse import urlparse, urljoin


def get_safe_redirect_url(request):
    """
    Get and validate the 'next' parameter from request.
    Returns the safe redirect URL or None if invalid.
    Prevents open redirect vulnerabilities by only allowing same-domain URLs.
    """
    next_url = request.GET.get('next', '').strip()

    if not next_url:
        return None

    parsed = urlparse(next_url)

    if parsed.netloc:
        request_host = request.get_host()
        if parsed.netloc != request_host:
            return None

    if parsed.scheme and parsed.scheme not in ['http', 'https', '']:
        return None

    return parsed.path or '/'


def login_view(request):
    """
    Login page view that renders the login template.
    If user is already authenticated, redirects to the 'next' URL or home page.
    """
    next_url = get_safe_redirect_url(request)

    if request.user.is_authenticated:
        return redirect(next_url or '/')

    display_next_url = next_url or request.session.get('auth_next_url', '')

    context = {
        'HCAPTCHA_SITE_KEY': getattr(settings, 'HCAPTCHA_SITE_KEY', ''),
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

    if request.user.is_authenticated:
        return redirect(next_url or '/')

    context = {
        'HCAPTCHA_SITE_KEY': getattr(settings, 'HCAPTCHA_SITE_KEY', ''),
        'next_url': next_url or '',
    }

    return render(request, 'board/auth/signup.html', context)


