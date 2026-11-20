from django.db import transaction
from django.http import Http404
from django.utils.translation import gettext

from board.models import IntegrationSetting
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.admin_settings_audit_service import AdminSettingsAuditService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.integration_setting_service import (
    IntegrationSettingConfigurationError,
    IntegrationSettingService,
)
from board.services.product_settings_permission_service import ProductSettingsPermissionService
from board.services.site_url_service import SiteUrlService
from board.services.telegram_webhook_service import (
    TelegramConnectionState,
    TelegramConnectionStatus,
    TelegramWebhookService,
)


def integration_settings(request):
    """
    IntegrationSetting GET/PUT API endpoint.

    GET /v1/integration-settings - Get current integration settings
    PUT /v1/integration-settings - Update integration settings
    """
    permission_error = ProductSettingsPermissionService.require_integration_settings(
        request.user,
    )
    if permission_error:
        return permission_error

    setting = IntegrationSetting.get_instance()
    webhook_url = SiteUrlService.absolute_url(request, TelegramWebhookService.WEBHOOK_PATH)

    if request.method == 'GET':
        return StatusDone({
            **IntegrationSettingService.serialize_admin_config(setting),
            'telegram_connection': TelegramWebhookService.inspect(setting, webhook_url).to_dict(),
        })

    if request.method == 'PUT':
        put_data, body_error = ApiRequestBodyService.parse_json_or_error(request, require_body=True)
        if body_error:
            return body_error

        try:
            IntegrationSettingService.update_admin_config(setting, put_data)
            bot_failure = TelegramWebhookService.confirm_bot(setting) if setting.telegram_enabled else None
            if bot_failure and bot_failure.state == TelegramConnectionState.INVALID_TOKEN:
                raise IntegrationSettingConfigurationError(
                    gettext('Telegram rejected this bot token. Check the token and try again.')
                )
        except IntegrationSettingConfigurationError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        with transaction.atomic():
            setting.save()
            AdminSettingsAuditService.record_change(
                user=request.user,
                target=setting,
                change_message='Updated notification integration settings',
            )

        # Register only after saving, so updates Telegram sends right away meet the saved bot settings.
        if not setting.telegram_enabled:
            connection = TelegramConnectionStatus(TelegramConnectionState.DISABLED)
        else:
            connection = bot_failure or TelegramWebhookService.register_webhook(setting, webhook_url)

        return StatusDone({
            **IntegrationSettingService.serialize_admin_config(setting),
            'telegram_connection': connection.to_dict(),
        })

    raise Http404
