import json
from django.http import Http404

from modules import markdown
from board.decorators import api_editor_required_methods
from board.modules.response import StatusDone, StatusError, ErrorCode


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
    
    try:
        if request.content_type == 'application/json':
            data = json.loads(request.body)
            text = data.get('text', '')
        else:
            text = request.POST.get('text', '')
        
        if not text:
            return StatusError(ErrorCode.INVALID_PARAMETER, '텍스트가 비어있습니다.')
        
        html = markdown.parse_post_to_html(text)
        
        return StatusDone({
            'html': html
        })
    except json.JSONDecodeError:
        return StatusError(ErrorCode.INVALID_PARAMETER)
