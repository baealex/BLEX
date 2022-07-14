from django.conf import settings
from django.http import HttpResponse, Http404

from modules.telegram import TelegramBot

from board.modules.analytics import get_network_addr

def error_report(request):
    if request.method == 'POST':
        if settings.TELEGRAM_ERROR_REPORT_ID and settings.TELEGRAM_BOT_TOKEN:
            user = request.POST.get('user')
            path = request.POST.get('path')
            user_addr = get_network_addr(request)
            user_agent = request.META['HTTP_USER_AGENT']
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
            bot.send_message(settings.TELEGRAM_ERROR_REPORT_ID, message)
        return HttpResponse(status=200)
    raise Http404
