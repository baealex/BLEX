import datetime
import time

from django.db.models import F, Q, Count, When, Case, Subquery, OuterRef, BooleanField
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import Invitation, InvitationRequest
from board.modules.analytics import create_device, get_network_addr
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime


def invitation_owners(request):
    invitations = Invitation.objects.filter(receiver__isnull=True)

    return StatusDone(list(map(lambda invitation: {
        'user': invitation.sender.username,
        'user_image': invitation.sender.profile.get_thumbnail(),
        'user_description': invitation.sender.profile.bio,
    }, invitations)))

def invitation_requests(request):
    if request.method == 'POST':
        has_invitation_request = InvitationRequest.objects.filter(sender=request.user).exists()
        if has_invitation_request:
            return StatusError(ErrorCode.VALIDATE, '이미 요청한 다른 에디터에게 요청했습니다.')

        sender = request.user
        receiver = request.POST.get('receiver', '')
        content = request.POST.get('content', '')

        if not receiver:
            return StatusError(ErrorCode.VALIDATE, '받는 사람을 입력해주세요.')

        if not content:
            return StatusError(ErrorCode.VALIDATE, '내용을 입력해주세요.')

        try:
            request = InvitationRequest.objects.create(**request_data)
        except Exception as e:
            return StatusError(ErrorCode.INVITATION_REQUEST_ERROR)

        return StatusDone(request.to_dict())