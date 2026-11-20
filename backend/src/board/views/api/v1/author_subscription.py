from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_http_methods

from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.author_subscription_service import (
    AuthorSubscriptionError,
    AuthorSubscriptionService,
)


@require_http_methods(['GET', 'POST', 'DELETE'])
def author_subscription(request, username):
    """
    GET    /v1/users/@<username>/subscription -> { can_subscribe, is_subscribed }
    POST   /v1/users/@<username>/subscription -> subscribe to the author
           (adds suggest_telegram_connection)
    DELETE /v1/users/@<username>/subscription -> unsubscribe from the author
    """
    author = get_object_or_404(
        User.objects.select_related('profile'),
        username=username,
    )

    if request.method == 'GET':
        state = AuthorSubscriptionService.get_state(request.user, author)
        return StatusDone(state.to_dict())

    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'DELETE':
        state = AuthorSubscriptionService.unsubscribe(request.user, author)
        return StatusDone(state.to_dict())

    try:
        state = AuthorSubscriptionService.subscribe(request.user, author)
    except AuthorSubscriptionError as error:
        return StatusError(error.code, error.message)

    return StatusDone({
        **state.to_dict(),
        'suggest_telegram_connection': (
            AuthorSubscriptionService.should_suggest_telegram_connection(request.user)
        ),
    })


@require_GET
def my_subscriptions(request):
    """GET /v1/subscriptions -> { subscriptions: [...], is_telegram_connected }"""
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    return StatusDone(
        AuthorSubscriptionService.get_settings_subscriptions(request.user),
    )
