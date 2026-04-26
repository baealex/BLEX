from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def developer_api_docs(request, operation_id=''):
    return render(request, 'board/developer_api_docs.html')
