from django.shortcuts import redirect


def developer_api_docs(request, operation_id=''):
    return redirect('/api/developer/v1/docs')
