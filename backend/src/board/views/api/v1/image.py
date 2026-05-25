from django.http import Http404

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_permission_service import ApiPermissionService
from board.services.image_upload_service import ImageUploadError, ImageUploadService


def image(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404

        permission_error = ApiPermissionService.require_editor(request.user)
        if permission_error:
            return permission_error

        try:
            url = ImageUploadService.upload_content_image(
                request.FILES.get('image'),
                user=request.user,
            )
            return StatusDone({'url': url})
        except ImageUploadError as error:
            if error.code in ('image.missing', 'image.invalid_extension'):
                return StatusError(ErrorCode.VALIDATE, error.message)
            return StatusError(ErrorCode.REJECT, error.message)

    raise Http404
