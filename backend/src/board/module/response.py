import humps

from django.http import JsonResponse

def CamelizeJsonResponse(obj, json_dumps_params={
    'ensure_ascii': True
}):
    return JsonResponse(
        humps.camelize(obj),
        json_dumps_params=json_dumps_params
    )

def StatusDone(body={}):
    return CamelizeJsonResponse({
        'status': 'DONE',
        'body': body,
    })

def StatusError(code: str):
    return CamelizeJsonResponse({
        'status': 'ERROR',
        'error_code': 'error:' + code,
    })