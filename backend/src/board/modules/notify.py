from django.conf import settings

from board.models import Notify
from modules.hash import get_sha256
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot

def create_notify(user, url: str, infomation: str, hidden_key: str = None):
    hash_key = get_sha256(user.username + url + infomation + (hidden_key if hidden_key else ''))
    if Notify.objects.filter(key=hash_key).exists():
        return
    
    new_notify = Notify(user=user, url=url, infomation=infomation, key=hash_key)
    new_notify.save()
    if hasattr(user, 'telegramsync'):
        tid = user.telegramsync.tid
        if not tid == '':
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            sub_task_manager.append(lambda: bot.send_messages(tid, [
                settings.SITE_URL + str(url),
                infomation
            ]))