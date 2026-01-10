import json
from django.http import Http404
from django.views.decorators.csrf import csrf_exempt

from modules import markdown
from board.modules.response import StatusDone, StatusError, ErrorCode


@csrf_exempt
def markdown_to_html(request):
    """
    Convert markdown text to HTML.
    
    POST /api/v1/markdown
    Body: { "text": "# Hello World" }
    Response: { "body": { "html": "<h2 id='hello-world'>Hello World</h2>" } }
    """
    if request.method != 'POST':
        raise Http404
    
    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN)
    
    # Check if user has editor permission
    if not hasattr(request.user, 'profile') or not request.user.profile.is_editor():
        return StatusError(ErrorCode.NEED_LOGIN, '편집자 권한이 필요합니다.')

    
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            text = data.get('text', '')
        else:
            text = request.POST.get('text', '')
        
        if not text:
            return StatusError(ErrorCode.INVALID_PARAMETER, '텍스트가 비어있습니다.')
        
        html = markdown.parse_to_html(text)
        
        return StatusDone({
            'html': html
        })
    except json.JSONDecodeError:
        return StatusError(ErrorCode.INVALID_PARAMETER)
