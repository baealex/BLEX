from django.shortcuts import render, redirect
from django.conf import settings


def login_view(request):
    """
    Login page view that renders the login template.
    If user is already authenticated, redirects to home page.
    """
    # If user is already authenticated, redirect to home page
    if request.user.is_authenticated:
        return redirect('/')
    
    context = {
        'HCAPTCHA_SITE_KEY': getattr(settings, 'HCAPTCHA_SITE_KEY', ''),
        'show_2fa': 'pending_2fa_user_id' in request.session,
        'username': request.session.get('pending_2fa_username', '')
    }
    
    return render(request, 'board/login.html', context)


def signup_view(request):
    """
    Signup page view that renders the signup template.
    If user is already authenticated, redirects to home page.
    """
    # If user is already authenticated, redirect to home page
    if request.user.is_authenticated:
        return redirect('/')
    
    return render(request, 'board/signup.html')


