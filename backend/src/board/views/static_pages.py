from django.shortcuts import render, get_object_or_404

from board.models import StaticPage


def custom_404_view(request, exception=None):
    """
    Custom 404 error page handler.
    """
    return render(request, 'board/404.html', status=404)


def static_page_view(request, slug):
    """
    Dynamic view for static pages created in admin.
    Accessible via /static/<slug>/ URLs.
    """
    # Get the page by slug, only if it's published
    page = get_object_or_404(StaticPage, slug=slug, is_published=True)

    context = {
        'page': page,
        'title': page.title,
        'meta_description': page.meta_description or page.title,
    }

    return render(request, 'board/pages/static_page.html', context)
