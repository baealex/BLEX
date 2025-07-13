from django.shortcuts import render

def about_view(request):
    """
    View function for the About page.
    """
    return render(request, 'board/about.html')

def privacy_view(request):
    """
    View function for the Privacy Policy page.
    """
    return render(request, 'board/privacy.html')

def terms_view(request):
    """
    View function for the Terms of Service page.
    """
    return render(request, 'board/terms.html')
