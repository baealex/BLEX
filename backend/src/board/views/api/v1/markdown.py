from django.http import Http404
from django.utils.translation import gettext

from modules import markdown
from board.decorators import api_editor_required_methods
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService


@api_editor_required_methods(['POST'])
def markdown_to_html(request):
    """
    Convert markdown text to HTML.
    
    POST /api/v1/markdown
    Body: { "text": "# Hello World" }
    Response: { "body": { "html": "<h2 id='hello-world'>Hello World</h2>" } }
    """
    if request.method != 'POST':
        raise Http404

    if request.content_type == 'application/json':
        data, body_error = ApiRequestBodyService.parse_json_or_error(
            request,
            error_code=ErrorCode.INVALID_PARAMETER,
        )
        if body_error:
            return body_error
        text = data.get('text', '')
    else:
        text = request.POST.get('text', '')

    if not text:
        return StatusError(
            ErrorCode.INVALID_PARAMETER,
            gettext('Text cannot be empty.'),
        )

    html = markdown.parse_post_to_html(text)

    return StatusDone({
        'html': html
    })
