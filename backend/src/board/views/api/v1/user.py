from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.models import User
from board.services import UserService
from board.services.user_service import UserValidationError
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_since


def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('about'):
            try:
                UserService.validate_user_permissions(request.user, user)
                about_md = put.get('about_md')
                UserService.update_user_about(user, about_md)
                return StatusDone()
            except UserValidationError as e:
                return StatusError(e.code, e.message)

    raise Http404


def check_redirect(request, username):
    if request.method == 'GET':
        if not username:
            return StatusError(ErrorCode.INVALID_PARAMETER)

        redirect_info = UserService.check_username_redirect(username)

        if redirect_info:
            return StatusDone({
                'old_username': redirect_info['old_username'],
                'new_username': redirect_info['new_username'],
                'created_date': convert_to_localtime(
                    redirect_info['created_date']
                ).strftime('%Y년 %m월 %d일'),
            })

    raise Http404
