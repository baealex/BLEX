import json
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.views.decorators.csrf import csrf_exempt

from board.models import Form
from board.modules.time import convert_to_localtime
from board.modules.response import StatusDone, StatusError, ErrorCode


@csrf_exempt
def forms_list(request):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

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
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                title = data.get('title', '')
                content = data.get('content', '')
            else:
                title = request.POST.get('title', '')
                content = request.POST.get('content', '')
            
            form = Form(
                user=request.user,
                title=title,
                content=content
            )
            form.save()
            return StatusDone({
                'id': form.id
            })
        except json.JSONDecodeError:
            return StatusError(ErrorCode.INVALID_PARAMETER)


@csrf_exempt
def forms_detail(request, id):
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if request.method == 'GET':
        form = get_object_or_404(Form, id=id, user=request.user)
        return StatusDone({
            'id': form.id,
            'title': form.title,
            'content': form.content
        })

    if request.method == 'PUT':
        try:
            if request.content_type == 'application/json':
                data = json.loads(request.body)
                title = data.get('title', '')
                content = data.get('content', '')
            else:
                from django.http import QueryDict
                body = QueryDict(request.body)
                title = body.get('title', '')
                content = body.get('content', '')
            
            form = get_object_or_404(Form, id=id, user=request.user)
            form.title = title
            form.content = content
            form.save()
            return StatusDone()
        except json.JSONDecodeError:
            return StatusError(ErrorCode.INVALID_PARAMETER)

    if request.method == 'DELETE':
        form = get_object_or_404(Form, id=id, user=request.user)
        form.delete()
        return StatusDone()

    raise Http404
