import json

from django.conf import settings
from django.http import Http404
from django.utils import timezone

from board.models import TelegramSync
from board.modules.response import StatusDone, StatusError
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot
from modules.randomness import randstr


def telegram(request, parameter):
    if parameter == 'webHook':
        if request.method == 'POST':
            print(request.body.decode("utf-8"))
            bot = TelegramBot(settings.TELEGRAM_BOT_TOKEN)
            try:
                req = json.loads(request.body.decode("utf-8"))
                req_userid = req['message']['from']['id']
                req_token = req['message']['text']
                
                telegram_sync = TelegramSync.objects.get(auth_token=req_token)
                if telegram_sync:
                    if not telegram_sync.is_token_expire():
                        telegram_sync.tid = req_userid
                        telegram_sync.auth_token = ''
                        telegram_sync.save()
                        sub_task_manager.append(lambda: bot.send_message(req_userid, '정상적으로 연동되었습니다.'))
                    else:
                        telegram_sync.auth_token = ''
                        telegram_sync.save()
                        sub_task_manager.append(lambda: bot.send_message(req_userid, '기간이 만료된 토큰입니다. 홈페이지에서 연동을 다시 시도하십시오.'))

            except:
                message = '블렉스 다양한 정보를 살펴보세요!\n\n' + settings.SITE_URL + '/notion'
                sub_task_manager.append(lambda: bot.send_message(req_userid, message))
            return StatusDone()
    
    if parameter == 'makeToken':
        if request.method == 'POST':
            token = randstr(6)
            has_token = TelegramSync.objects.filter(auth_token=token)
            while len(has_token) > 0:
                token = randstr(6)
                has_token = TelegramSync.objects.filter(auth_token=token)
            if hasattr(request.user, 'telegramsync'):
                telegramsync = request.user.telegramsync
                telegramsync.auth_token = token
                telegramsync.auth_token_exp = timezone.now()
                telegramsync.save()
                return StatusDone({
                    'token': token
                })
            else:
                telegramsync = TelegramSync(user=request.user)
                telegramsync.auth_token = token
                telegramsync.save()
                return StatusDone({
                    'token': token
                })
    
    if parameter == 'unsync':
        if request.method == 'POST':
            if hasattr(request.user, 'telegramsync'):
                telegramsync = request.user.telegramsync
                if not telegramsync.tid == '':
                    telegramsync.delete()
                    return StatusDone()
            return StatusError('AE', '이미 연동이 해제되었습니다.')
    
    raise Http404
