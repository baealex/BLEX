from django.http import HttpResponse, Http404


def error_report(request):
    """
    Accept legacy browser error reports without forwarding them.
    """
    if request.method == 'POST':
        return HttpResponse(status=200)
    raise Http404
