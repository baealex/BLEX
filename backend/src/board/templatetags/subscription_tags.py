from django import template
from django.contrib.auth.models import AnonymousUser, User

from board.services.author_subscription_service import (
    AuthorSubscriptionService,
    AuthorSubscriptionState,
)


register = template.Library()


@register.simple_tag(takes_context=True)
def author_subscription_state(
    context: template.Context,
    author: User,
) -> AuthorSubscriptionState:
    request = context.get('request')
    viewer = getattr(request, 'user', None) or AnonymousUser()
    return AuthorSubscriptionService.get_state(viewer, author)
