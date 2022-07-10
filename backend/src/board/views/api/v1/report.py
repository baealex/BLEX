from django.conf import settings
from django.http import HttpResponse, Http404

from modules.telegram import TelegramBot

def error_report(request):
    if request.method == 'POST':
        if settings.TELEGRAM_USE and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_ADMIN_ID:
            user = request.POST.get('user')
            path = request.POST.get('path')
            content = request.POST.get('content')

            message = '[ERROR REPORT]\n'
            if user:
                message += 'User: ' + user + '\n'
            if path:
                message += 'Path: ' + path + '\n'
            
            message += '\n' + content

            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            bot.send_message(settings.TELEGRAM_ADMIN_ID, message)
        return HttpResponse(status=200)
    raise Http404
