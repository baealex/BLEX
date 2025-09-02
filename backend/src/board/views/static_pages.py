from django.shortcuts import render

def custom_404_view(request, exception=None):
    """
    Custom 404 error page handler.
    """
    return render(request, 'board/404.html', status=404)

def about_view(request):
    """
    View function for the About page.
    """
    return render(request, 'board/pages/about.html')

def privacy_view(request):
    """
    View function for the Privacy Policy page.
    """
    return render(request, 'board/pages/privacy.html')

def terms_view(request):
    """
    View function for the Terms of Service page.
    """
    return render(request, 'board/pages/terms.html')
