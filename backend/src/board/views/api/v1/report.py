from django.conf import settings
from django.http import HttpResponse, Http404

from modules.telegram import TelegramBot


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def error_report(request):
    """
    Send error reports to Telegram.
    This does not depend on Device model.
    """
    if request.method == 'POST':
        if settings.TELEGRAM_ERROR_REPORT_ID and settings.TELEGRAM_BOT_TOKEN:
            user = request.POST.get('user')
            path = request.POST.get('path')
            user_addr = get_client_ip(request)
            user_agent = request.META.get('HTTP_USER_AGENT', '')
            content = request.POST.get('content')

            message = '[ERROR REPORT]\n'
            if user:
                message += 'User: ' + user + '\n'
            if path:
                message += 'Path: ' + path + '\n'
            if user_addr:
                message += 'Location: ' + user_addr + '\n'
            if user_agent:
                message += 'UserAgent: ' + user_agent + '\n'

            message += '\n' + content

            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            try:
                bot.send_message(settings.TELEGRAM_ERROR_REPORT_ID, message)
            except Exception:
                pass
        return HttpResponse(status=200)
    raise Http404
