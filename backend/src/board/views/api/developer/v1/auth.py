from django.http import Http404
from django.views.decorators.csrf import csrf_exempt

from board.modules.developer_response import DeveloperResponse
from board.services.developer_token_service import (
    DeveloperAuthError,
    DeveloperTokenService,
)


@csrf_exempt
def me(request):
    if request.method != 'GET':
        raise Http404

    try:
        token = DeveloperTokenService.authenticate_request(request)
    except DeveloperAuthError as error:
        return DeveloperResponse.error(
            error.code,
            error.message,
            error.status_code,
        )

    response = DeveloperResponse.success({
        'user': {
            'id': token.user.id,
            'username': token.user.username,
            'name': token.user.first_name,
            'email': token.user.email,
            'is_editor': hasattr(token.user, 'profile') and token.user.profile.is_editor(),
        },
        'token': {
            'id': token.id,
            'name': token.name,
            'token_prefix': token.token_prefix,
            'scopes': token.scopes,
        },
    })
    DeveloperTokenService.record_request(request, token, response.status_code)
    return response
