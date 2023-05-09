from django.conf import settings
from django.http import Http404

from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.post_description import create_post_description

from modules import markdown


def openai(request, parameter):
    if parameter == 'description':
        if request.method == 'POST':
            if hasattr(request.user, 'openaiconnection'):
                text_md = request.POST.get('text_md', '')
                text_html = markdown.parse_to_html(settings.API_URL, markdown.ParseData.from_dict({
                    'text': text_md,
                    'token': settings.API_KEY,
                }))
                description = create_post_description(
                    post_content_html=text_html,
                    write_type='detail',
                    api_key=request.user.openaiconnection.api_key,
                    user=request.user,
                )
                return StatusDone({
                    'description': description
                })
            return StatusError(ErrorCode.NEED_OPENAI)

    raise Http404
