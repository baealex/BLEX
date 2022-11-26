from django.shortcuts import get_object_or_404
from django.http import QueryDict

from board.models import Form, convert_to_localtime
from board.modules.response import StatusDone, StatusError

def forms(request, pk=None):
    if not request.user.is_active:
        return StatusError('NL')
    
    if not pk:
        if request.method == 'GET':
            user_forms = Form.objects.filter(user=request.user)
            return StatusDone({
                'forms': list(map(lambda form: {
                    'id': form.id,
                    'title': form.title,
                    'created_date': convert_to_localtime(form.created_date),
                }, user_forms))
            })

        if request.method == 'POST':
            new_from = Form(
                user=request.user,
                title=request.POST.get('title', ''),
                content=request.POST.get('content', '')
            )
            new_from.save()
            return StatusDone({
                'id': new_from.id
            })
    
    else:
        if request.method == 'GET':
            form = get_object_or_404(Form, pk=pk, user=request.user)
            return StatusDone({
                'title': form.title,
                'content': form.content
            })
        
        if request.method == 'PUT':
            body = QueryDict(request.body)
            form = get_object_or_404(Form, pk=pk, user=request.user)
            form.title = body.get('title', '')
            form.content = body.get('content', '')
            form.save()
            return StatusDone()
        
        if request.method == 'DELETE':
            form = get_object_or_404(Form, pk=pk)
            form.delete()
            return StatusDone()
    
    raise Http404
