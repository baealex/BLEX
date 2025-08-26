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


def signup_view(request):
    """
    Signup page view that renders the signup template.
    If user is already authenticated, redirects to home page.
    """
    # If user is already authenticated, redirect to home page
    if request.user.is_authenticated:
        return redirect('/')
    
    return render(request, 'board/signup.html')


