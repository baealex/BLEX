from django.http import JsonResponse


class DeveloperResponse:
    @staticmethod
    def success(data=None, status=200):
        if data is None:
            data = {}
        return JsonResponse(
            {'data': data},
            status=status,
            json_dumps_params={'ensure_ascii': True},
        )

    @staticmethod
    def error(code, message, status=400, fields=None):
        payload = {
            'error': {
                'code': code,
                'message': message,
            }
        }
        if fields:
            payload['error']['fields'] = fields

        return JsonResponse(
            payload,
            status=status,
            json_dumps_params={'ensure_ascii': True},
        )
