from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required


def login_view(request):
    """
    Login page view that renders the login template.
    If user is already authenticated, redirects to home page.
    """
    # If user is already authenticated, redirect to home page
    if request.user.is_authenticated:
        return redirect('/')
    
    return render(request, 'board/login.html')


@login_required
def security_view(request):
    """
    Two-factor authentication security page view.
    This is a placeholder for the 2FA verification page.
    """
    # This is a placeholder - you would implement the 2FA verification here
    return render(request, 'board/security.html')
