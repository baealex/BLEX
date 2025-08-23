from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib import messages

from board.models import Series

@login_required
def setting_profile(request):
    """
    Profile settings page view.
    Renders the profile settings template with user profile data.
    """
    if request.method == 'POST':
        # Handle profile form submission
        user = request.user
        if hasattr(user, 'profile'):
            profile = user.profile
            profile.homepage = request.POST.get('homepage', '')
            profile.bio = request.POST.get('bio', '')
            profile.save()
            messages.success(request, '프로필이 업데이트되었습니다.')
        return redirect('setting_profile')
    
    # Get social links for the user
    from board.models import UserLinkMeta
    social_links = UserLinkMeta.objects.filter(user=request.user).order_by('order')
    
    context = {
        'social_links': social_links,
        'active': 'profile'
    }
    return render(request, 'board/setting/setting_profile.html', context)


@login_required
def setting_account(request):
    """
    Account settings page view.
    Renders the account settings template with user account data.
    """
    if request.method == 'POST':
        user = request.user
        
        if 'update_name' in request.POST:
            # Update user's name
            name = request.POST.get('name', '').strip()
            if name:
                # Split name into first and last name
                name_parts = name.split(' ', 1)
                user.first_name = name_parts[0]
                user.last_name = name_parts[1] if len(name_parts) > 1 else ''
                user.save()
                messages.success(request, '이름이 업데이트되었습니다.')
        
        elif 'update_password' in request.POST:
            # Update password
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')
            
            if new_password and new_password == confirm_password:
                # Add password validation logic here
                if len(new_password) >= 8:
                    user.set_password(new_password)
                    user.save()
                    messages.success(request, '비밀번호가 변경되었습니다.')
                else:
                    messages.error(request, '비밀번호는 8자 이상이어야 합니다.')
            else:
                messages.error(request, '비밀번호가 일치하지 않습니다.')
        
        elif 'update_username' in request.POST:
            # Handle username update via AJAX
            username = request.POST.get('username')
            if username and username != user.username:
                # Add username validation logic here
                user.username = username
                user.save()
                return JsonResponse({'success': True})
            return JsonResponse({'success': False, 'message': '잘못된 사용자명입니다.'})
        
        return redirect('setting_account')
    
    # Check if user has 2FA enabled (placeholder - implement based on your 2FA system)
    has_2fa = False  # TODO: Implement actual 2FA check
    
    context = {
        'has_2fa': has_2fa,
        'active': 'account'
    }
    return render(request, 'board/setting/setting_account.html', context)


@login_required
def setting_notify(request):
    """
    Notification settings page view.
    Renders the notification settings template with user notification preferences.
    """
    context = {
        'notifications': [],  # Will be loaded via API
        'notify_config': {},   # Will be loaded via API
        'active': 'notify'
    }
    return render(request, 'board/setting/setting_notify.html', context)


@login_required
def setting_series(request):
    """
    Series management page view.
    Renders the series management template with user's series data.
    """
    from board.models import Series
    from django.db.models import Count
    
    # Get user's series with post count
    user_series = Series.objects.filter(
        owner=request.user
    ).annotate(
        total_posts=Count('posts')
    ).order_by('order', '-created_date')
    
    context = {
        'user_series': user_series,
        'active': 'series'
    }
    return render(request, 'board/setting/setting_series.html', context)


@login_required
def setting_posts(request):
    """
    Posts management page view.
    Renders the posts management template with user's posts data.
    """
    context = {
        'active': 'posts'
    }
    return render(request, 'board/setting/setting_posts.html', context)


@login_required
def setting_analytics(request):
    """
    Analytics settings page view.
    Renders the analytics template with user's visitor statistics.
    """
    context = {
        'active': 'analytics'
    }
    return render(request, 'board/setting/setting_analytics.html', context)


@login_required
def setting_analytics_views(request):
    """
    Analytics views page - shows view statistics and charts.
    """
    context = {
        'active': 'analytics/views'
    }
    return render(request, 'board/setting/analytics/setting_analytics_views.html', context)


@login_required
def setting_analytics_referer(request):
    """
    Analytics referer page - shows referrer statistics.
    """
    context = {
        'active': 'analytics/referer'
    }
    return render(request, 'board/setting/analytics/setting_analytics_referer.html', context)


@login_required
def setting_integration(request):
    """
    Integration settings page view.
    Renders the integration settings template with user's integration configurations.
    """
    context = {
        'telegram_connection': {
            'is_connected': False,  # Will be determined from database
            'telegram_id': None
        },
        'telegram_token': None,  # Will be generated if needed
        'active': 'integration'
    }
    return render(request, 'board/setting/setting_integration.html', context)


@login_required
def setting_invitation(request):
    """
    Invitation management page view.
    Renders the invitation management template with user's invitation codes.
    """
    context = {
        'active': 'invitation'
    }
    return render(request, 'board/setting/setting_invitation.html', context)


@login_required
def setting_forms(request):
    """
    Forms management page view.
    Renders the forms management template with user's saved forms.
    """
    context = {
        'forms': [],  # Will be loaded from database
        'active': 'forms'
    }
    return render(request, 'board/setting/setting_forms.html', context)
