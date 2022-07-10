from django.conf import settings
from django.http import HttpResponse, Http404

from modules.telegram import TelegramBot

def error_report(request):
    if request.method == 'POST':
        if settings.TELEGRAM_USE and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_ADMIN_ID:
            body_unicode = request.body.decode('utf-8')
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            bot.send_message(settings.TELEGRAM_ADMIN_ID, f'[ERROR REPORT]\n{body_unicode}')
        return HttpResponse(status=200)
    raise Http404
