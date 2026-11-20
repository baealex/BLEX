from urllib.parse import urlencode

from django.contrib import auth, messages
from django.http import Http404, HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils.translation import gettext
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_http_methods

from board.services.account_reauthentication_service import AccountReauthenticationService
from board.services.auth_service import AuthService, OAuthService
from board.services.initial_setup_service import InitialSetupService
from board.services.oauth_flow_service import OAuthFlowService
from board.services.social_signup_service import SocialSignupError, SocialSignupService
from board.services.social_auth_provider_service import SocialAuthProviderService
from board.views.auth import get_safe_redirect_url


@never_cache
@require_http_methods(['GET', 'POST'])
def oauth_start(request: HttpRequest, provider: str) -> HttpResponse:
    if provider not in OAuthFlowService.PROVIDERS:
        raise Http404
    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('initial_setup')

    reauthenticate = request.method == 'POST'
    next_url = get_safe_redirect_url(request) or ('/settings/account' if reauthenticate else '/')
    if reauthenticate:
        if not request.user.is_authenticated:
            return redirect('login')
        if not request.user.socialauth_set.filter(provider__key=provider).exists():
            raise Http404
    elif request.user.is_authenticated:
        return redirect(next_url)

    OAuthService.clear_2fa_data(request.session)
    authorize_url = OAuthFlowService.start(request, provider, next_url, reauthenticate)
    if authorize_url:
        return redirect(authorize_url)
    messages.error(request, gettext('Social login is not configured.'))
    if reauthenticate:
        return redirect('/reauthenticate?' + urlencode({'next': next_url}))
    return redirect(reverse('login', query={'next': next_url} if next_url != '/' else None))


@never_cache
@require_GET
def oauth_callback(request: HttpRequest, provider: str) -> HttpResponse:
    if provider not in OAuthFlowService.PROVIDERS:
        raise Http404
    if InitialSetupService.should_prompt_for_initial_setup():
        return redirect('initial_setup')
    if SocialAuthProviderService.get_enabled_provider(provider) is None:
        messages.error(request, gettext('Social login is not configured.'))
        return redirect('login')

    flow = OAuthFlowService.consume(request, provider, request.GET.get('state', ''))
    if not flow:
        messages.error(request, gettext('Social login failed. Please try again.'))
        return redirect('login')

    reauthenticate = flow['user_id'] is not None
    next_url = flow['next_url']
    verification_url = '/reauthenticate?' + urlencode({'next': next_url})
    login_url = reverse('login', query={'next': next_url} if next_url != '/' else None)
    try:
        result = SocialSignupService.sign_up(
            provider, request.GET.get('code'), flow['verifier'], flow['redirect_uri'],
            expected_user_id=flow['user_id'],
        )
    except SocialSignupError:
        messages.error(request, gettext('Social login failed. Please try again.'))
        return redirect(verification_url if reauthenticate else login_url)

    if reauthenticate:
        if AuthService.check_two_factor_auth(result.user):
            AccountReauthenticationService.record(request, AccountReauthenticationService.PENDING_SOCIAL_KEY)
            return redirect(verification_url)
        AccountReauthenticationService.record(request, AccountReauthenticationService.SESSION_KEY)
        return redirect(next_url)

    if AuthService.check_two_factor_auth(result.user):
        OAuthService.set_2fa_data(request.session, result.user, next_url)
        return redirect('login')

    auth.login(request, result.user)
    return redirect(next_url)
