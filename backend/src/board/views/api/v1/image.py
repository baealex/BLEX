from django.http import Http404

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.image_upload_service import ImageUploadError, ImageUploadService


def image(request):
    if request.method == 'POST':
        if not request.user.is_active:
            raise Http404

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
