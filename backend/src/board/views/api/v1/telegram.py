from django.http import Http404, HttpRequest, HttpResponse, HttpResponseForbidden
from django.utils.translation import gettext
from django.views.decorators.csrf import csrf_exempt, csrf_protect

from board.models import IntegrationSetting
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.integration_setting_service import IntegrationSettingService
from board.services.telegram_link_service import TelegramLinkService
from board.services.telegram_webhook_service import TelegramWebhookService
from modules.sub_task import SubTaskProcessor
from modules.telegram import TelegramBot


@csrf_exempt
def telegram(request: HttpRequest, parameter: str) -> HttpResponse:
    # Telegram cannot send a CSRF token, so the webhook proves its origin with a secret header.
    # Every other action is a browser request and keeps CSRF protection.
    if parameter == 'webHook':
        if request.method == 'POST':
            return telegram_webhook(request)
        raise Http404

    return telegram_account(request, parameter)


def telegram_webhook(request: HttpRequest) -> HttpResponse:
    bot_token = IntegrationSettingService.get_telegram_bot_token()
    if not bot_token:
        return StatusDone()

    if not TelegramWebhookService.is_authentic_request(request, bot_token):
        return HttpResponseForbidden()

    payload = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
    message = TelegramLinkService.read_message(payload)
    if message is None:
        return StatusDone()

    result = TelegramLinkService.link_account(message)
    SubTaskProcessor.process(
        TelegramBot(bot_token).send_message,
        message.sender_id,
        TelegramLinkService.build_reply(result),
    )
    return StatusDone()


@csrf_protect
def telegram_account(request: HttpRequest, parameter: str) -> HttpResponse:
    if parameter == 'makeToken':
        if request.method == 'POST':
            if not request.user.is_authenticated:
                return StatusError(ErrorCode.NEED_LOGIN)

            if not IntegrationSettingService.is_telegram_configured():
                return StatusError(
                    ErrorCode.NEED_TELEGRAM,
                    gettext('The Telegram bot is not configured.'),
                )

            bot_username = IntegrationSetting.get_instance().telegram_bot_username.strip()
            return StatusDone(TelegramLinkService.issue_link(request.user, bot_username).to_dict())

    if parameter == 'unsync':
        if request.method == 'POST':
            if not request.user.is_authenticated:
                return StatusError(ErrorCode.NEED_LOGIN)

            if hasattr(request.user, 'telegramsync'):
                telegramsync = request.user.telegramsync
                if not telegramsync.tid == '':
                    telegramsync.delete()
                    return StatusDone()
            return StatusError(
                ErrorCode.ALREADY_DISCONNECTED,
                gettext('Telegram is already disconnected.'),
            )

    raise Http404
