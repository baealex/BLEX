from django.shortcuts import get_object_or_404
from django.http import Http404

from board.models import Form
from board.decorators import api_editor_required
from board.modules.time import convert_to_localtime
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService


@api_editor_required
def forms_list(request):
    if request.method == 'GET':
        forms = Form.objects.filter(user=request.user)
        return StatusDone({
            'forms': list(map(lambda form: {
                'id': form.id,
                'title': form.title,
                'created_date': convert_to_localtime(form.created_date),
            }, forms))
        })

    if request.method == 'POST':
        if request.content_type == 'application/json':
            data, body_error = ApiRequestBodyService.parse_json_or_error(
                request,
                error_code=ErrorCode.INVALID_PARAMETER,
            )
            if body_error:
                return body_error
        else:
            data = request.POST

        form = Form(
            user=request.user,
            title=data.get('title', ''),
            content=data.get('content', ''),
        )
        form.save()
        return StatusDone({
            'id': form.id
        })


@api_editor_required
def forms_detail(request, id):
    if request.method == 'GET':
        form = get_object_or_404(Form, id=id, user=request.user)
        return StatusDone({
            'id': form.id,
            'title': form.title,
            'content': form.content
        })

    if request.method == 'PUT':
        if request.content_type == 'application/json':
            data, body_error = ApiRequestBodyService.parse_json_or_error(
                request,
                error_code=ErrorCode.INVALID_PARAMETER,
            )
            if body_error:
                return body_error
        else:
            data = ApiRequestBodyService.parse_json_or_querydict(request)

        form = get_object_or_404(Form, id=id, user=request.user)
        form.title = data.get('title', '')
        form.content = data.get('content', '')
        form.save()
        return StatusDone()

    if request.method == 'DELETE':
        form = get_object_or_404(Form, id=id, user=request.user)
        form.delete()
        return StatusDone()

    raise Http404
