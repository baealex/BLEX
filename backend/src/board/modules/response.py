import humps

from enum import Enum

from django.http import JsonResponse


def CamelizeJsonResponse(obj, json_dumps_params={
    'ensure_ascii': True
}):
    return JsonResponse(
        humps.camelize(obj),
        json_dumps_params=json_dumps_params
    )


def StatusDone(body=None):
    return CamelizeJsonResponse({
        'status': 'DONE',
        'body': body if body else {},
    })


class ErrorCode(Enum):
    REQUIRE = 'RE'
    REJECT = 'RJ'
    EXPIRED = 'EP'
    VALIDATE = 'VA'
    NEED_LOGIN = 'NL'
    AUTHENTICATION = 'AT'
    SIZE_OVERFLOW = 'OF'
    ALREADY_EXISTS = 'AE'
    ALREADY_CONNECTED = 'AC'
    ALREADY_DISCONNECTED = 'AU'
    ALREADY_VERIFICATION = 'AV'
    NEED_TELEGRAM = 'NT'
    EMAIL_NOT_MATCH = 'EN'
    USERNAME_NOT_MATCH = 'UN'
    INVALID_PARAMETER = 'IP'
    NOT_FOUND = 'NF'


def StatusError(code: ErrorCode, message: str = ''):
    return CamelizeJsonResponse({
        'status': 'ERROR',
        'error_code': 'error:' + code.value,
        'error_message': message,
    })
