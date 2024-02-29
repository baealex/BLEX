from board.models import User, Invitation, InvitationRequest
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime


def invitation_owners(request):
    invitations = Invitation.objects.filter(receiver__isnull=True)

    return StatusDone(list(map(lambda invitation: {
        'user': invitation.sender.username,
        'user_image': invitation.sender.profile.get_thumbnail(),
        'user_description': invitation.sender.profile.bio,
    }, invitations)))

def invitation_requests(request):
    if request.method == 'GET':
        invitations = InvitationRequest.objects.filter(receiver=request.user)

        return StatusDone(list(map(lambda invitation: {
            'sender': invitation.sender.username,
            'sender_image': invitation.sender.profile.get_thumbnail(),
            'content': invitation.content,
            'created_date': convert_to_localtime(invitation.created_date),
        }, invitations)))

    if request.method == 'POST':
        has_invitation = Invitation.objects.filter(receiver=request.user).exists()
        if has_invitation:
            return StatusError(ErrorCode.VALIDATE, '이미 에디터로 초대되었습니다.')

        has_invitation_request = InvitationRequest.objects.filter(sender=request.user).exists()
        if has_invitation_request:
            return StatusError(ErrorCode.VALIDATE, '이미 다른 에디터에게 요청했습니다.')

        sender = request.user
        receiver = request.POST.get('receiver', '')
        content = request.POST.get('content', '')

        if sender.username == receiver:
            return StatusError(ErrorCode.VALIDATE, '자신에게 요청할 수 없습니다.')

        if not receiver:
            return StatusError(ErrorCode.VALIDATE, '받는 사람을 입력해주세요.')
        
        receiver_user = User.objects.filter(username=receiver)
        if not receiver_user.exists():
            return StatusError(ErrorCode.VALIDATE, '받는 사람을 찾을 수 없습니다.')
        receiver_user = receiver_user.first()

        if not content:
            return StatusError(ErrorCode.VALIDATE, '내용을 입력해주세요.')

        try:
            request = InvitationRequest.objects.create(
                sender=sender,
                receiver=receiver_user,
                content=content
            )
            create_notify(
                user=receiver_user,
                url='/setting/invitation',
                content=(
                    f'{sender.username}님이 에디터 초대를 요청했습니다. '
                    f'내용을 확인하신 후 승낙 또는 거절해 주세요.'
                )
            )
        except Exception as e:
            return StatusError(ErrorCode.INVITATION_REQUEST_ERROR)

        return StatusDone()