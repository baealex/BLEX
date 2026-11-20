from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from urllib.parse import unquote, urlsplit, urlunsplit
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import gettext
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from board.services.account_reauthentication_service import AccountReauthenticationService
from board.services.auth_service import AuthService, OAuthService
from board.services.hcaptcha_service import HCaptchaService
from board.services.initial_setup_service import InitialSetupService
from board.services.social_auth_provider_service import SocialAuthProviderService


def get_safe_redirect_url(request: HttpRequest) -> str | None:
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

    parsed = urlsplit(next_url)
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

    return urlunsplit(('', '', path, parsed.query, parsed.fragment))


@never_cache
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

    if request.GET.get('restart') == '1':
        OAuthService.clear_2fa_data(request.session)
    pending_oauth = OAuthService.get_2fa_data(request.session)
    if 'oauth_token' in request.GET:
        if pending_oauth is None:
            messages.info(request, gettext('Start social login again to continue.'))
        return redirect(reverse('login', query={'next': next_url} if next_url else None))
    display_next_url = pending_oauth['next_url'] if pending_oauth else next_url

    context = {
        'HCAPTCHA_SITE_KEY': HCaptchaService.get_site_key(),
        'show_2fa': bool(pending_oauth),
        'username': pending_oauth['username'] if pending_oauth else '',
        'next_url': display_next_url or '',
    }

    return render(request, 'board/auth/login.html', context)


@never_cache
@login_required
@require_http_methods(['GET', 'POST'])
def reauthenticate_view(request: HttpRequest) -> HttpResponse:
    service = AccountReauthenticationService
    next_url = get_safe_redirect_url(request) or '/settings/account'
    if service.has_recent_verification(request, service.SESSION_KEY):
        return redirect(next_url)

    error = ''
    if request.method == 'POST':
        error = service.verify(request, request.POST.get('password', ''), request.POST.get('code', ''))
        if not error:
            return redirect(next_url)

    has_social_proof = service.has_recent_verification(request, service.PENDING_SOCIAL_KEY)
    has_password = request.user.has_usable_password() and not has_social_proof
    providers = []
    if not has_social_proof:
        linked_keys = set(request.user.socialauth_set.values_list('provider__key', flat=True))
        providers = [
            provider for provider in SocialAuthProviderService.serialize_public_providers()
            if provider['key'] in linked_keys
        ]
    return render(request, 'board/auth/reauthenticate.html', {
        'next_url': next_url,
        'has_password': has_password,
        'show_verification_form': has_password or has_social_proof,
        'has_two_factor': AuthService.check_two_factor_auth(request.user),
        'providers': providers,
        'error': error,
    })


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
