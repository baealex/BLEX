from django.http import Http404
from django.shortcuts import get_object_or_404

from board.models import DeveloperToken
from board.decorators import api_editor_required
from board.modules.developer_serializers import DeveloperTokenSerializer
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.developer_token_service import (
    DeveloperAuthError,
    DeveloperTokenService,
)
from board.services.api_request_body_service import ApiRequestBodyService


class DeveloperTokenAPI:
    @staticmethod
    def json_body(request):
        return ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

    @staticmethod
    def auth_error(error):
        if error.status_code == 401:
            return StatusError(ErrorCode.NEED_LOGIN, error.message)
        if error.status_code == 403:
            return StatusError(ErrorCode.REJECT, error.message)
        return StatusError(ErrorCode.VALIDATE, error.message)

    @staticmethod
    def list_tokens(request):
        tokens = DeveloperToken.objects.filter(user=request.user)
        return StatusDone({
            'tokens': [
                DeveloperTokenSerializer.serialize(token)
                for token in tokens
            ]
        })

    @staticmethod
    def create_token(request):
        data = DeveloperTokenAPI.json_body(request)

        try:
            raw_token, token = DeveloperTokenService.create_token(
                user=request.user,
                name=data.get('name', ''),
                scopes=data.get('scopes'),
                expires_in_days=data.get('expires_in_days'),
            )
        except DeveloperAuthError as error:
            return DeveloperTokenAPI.auth_error(error)

        body = DeveloperTokenSerializer.serialize(token)
        body['token'] = raw_token
        return StatusDone(body)

    @staticmethod
    def revoke_token(request, token_id):
        token = get_object_or_404(
            DeveloperToken,
            id=token_id,
            user=request.user,
        )
        DeveloperTokenService.revoke_token(token)
        return StatusDone(DeveloperTokenSerializer.serialize(token))


@api_editor_required
def developer_tokens(request, token_id=None):
    if token_id is None:
        if request.method == 'GET':
            return DeveloperTokenAPI.list_tokens(request)
        if request.method == 'POST':
            return DeveloperTokenAPI.create_token(request)

    if token_id is not None:
        if request.method == 'DELETE':
            return DeveloperTokenAPI.revoke_token(request, token_id)

    raise Http404
