from django.http import Http404

def compere_user(req, res, give_404_if='none'):
    if give_404_if == 'same':
        if req == res:
            raise Http404
    else:
        if not req == res:
            raise Http404

def page_check(page, paginator):
    try:
        page = int(page)
    except:
        raise Http404
    if not page or int(page) > paginator.num_pages or int(page) < 1:
        raise Http404
