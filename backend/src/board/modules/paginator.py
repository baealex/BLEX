from django.core.paginator import Paginator as _Paginator
from django.http import Http404

def Paginator(objects, offset, page):
    paginator = _Paginator(objects, offset)

    try:
        page = int(page)
    except:
        raise Http404
    
    if not page or int(page) > paginator.num_pages or int(page) < 1:
        raise Http404
    
    return paginator.get_page(page)