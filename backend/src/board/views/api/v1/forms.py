from django.shortcuts import get_object_or_404
from django.http import Http404, QueryDict

from board.models import Form
from board.modules.time import convert_to_localtime
from board.modules.response import StatusDone, StatusError


def forms_list(request):
    if not request.user.is_active:
        return StatusError('NL')

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
        form = Form(
            user=request.user,
            title=request.POST.get('title', ''),
            content=request.POST.get('content', '')
        )
        form.save()
        return StatusDone({
            'id': form.id
        })


def forms_detail(request, id):
    if not request.user.is_active:
        return StatusError('NL')

    if request.method == 'GET':
        form = get_object_or_404(Form, id=id, user=request.user)
        return StatusDone({
            'title': form.title,
            'content': form.content
        })

    if request.method == 'PUT':
        body = QueryDict(request.body)
        form = get_object_or_404(Form, id=id, user=request.user)
        form.title = body.get('title', '')
        form.content = body.get('content', '')
        form.save()
        return StatusDone()

    if request.method == 'DELETE':
        form = get_object_or_404(Form, id=id)
        form.delete()
        return StatusDone()
    
    raise Http404
