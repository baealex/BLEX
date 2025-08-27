import json
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
            'id': invitation.id,
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
        
        try:
            data = json.loads(request.body)
            receiver = data.get('receiver', '')
            content = data.get('content', '')
        except (json.JSONDecodeError, AttributeError):
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


def invitation_respond(request, invitation_id):
    if request.method != 'PUT':
        return StatusError(ErrorCode.METHOD_NOT_ALLOWED)
    
    try:
        invitation_request = InvitationRequest.objects.get(
            id=invitation_id, 
            receiver=request.user
        )
    except InvitationRequest.DoesNotExist:
        return StatusError(ErrorCode.NOT_FOUND, '초대 요청을 찾을 수 없습니다.')
    
    try:
        data = json.loads(request.body)
        action = data.get('action')
    except (json.JSONDecodeError, AttributeError):
        return StatusError(ErrorCode.VALIDATE, '잘못된 요청입니다.')
    
    if action not in ['accept', 'reject']:
        return StatusError(ErrorCode.VALIDATE, '올바른 액션을 선택해주세요.')
    
    try:
        if action == 'accept':
            # 이미 에디터로 초대되었는지 확인 (다른 사람으로부터)
            has_invitation = Invitation.objects.filter(receiver=request.user).exists()
            if has_invitation:
                return StatusError(ErrorCode.VALIDATE, '이미 에디터로 초대되었습니다.')
            
            # 초대 승낙 - 기존의 sender가 receiver=None인 Invitation을 업데이트
            invitation = Invitation.objects.filter(
                sender=invitation_request.sender,
                receiver__isnull=True
            ).first()
            
            if invitation:
                invitation.receiver = request.user
                invitation.save()
            else:
                # 기존 Invitation이 없으면 새로 생성
                Invitation.objects.create(
                    sender=invitation_request.sender,
                    receiver=request.user
                )
            
            # 알림 생성
            create_notify(
                user=invitation_request.sender,
                url='/setting/invitation',
                content=f'{request.user.username}님이 에디터 초대를 승낙했습니다.'
            )
        
        else:  # reject
            # 알림 생성
            create_notify(
                user=invitation_request.sender,
                url='/setting/invitation',
                content=f'{request.user.username}님이 에디터 초대를 거절했습니다.'
            )
        
        # 초대 요청 삭제
        invitation_request.delete()
        
    except Exception as e:
        return StatusError(ErrorCode.INVITATION_REQUEST_ERROR, '처리 중 오류가 발생했습니다.')
    
    return StatusDone()