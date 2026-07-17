from django.db import transaction
from django.http import Http404

from board.models import IntegrationSetting
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.admin_settings_audit_service import AdminSettingsAuditService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.integration_setting_service import (
    IntegrationSettingConfigurationError,
    IntegrationSettingService,
)
from board.services.product_settings_permission_service import ProductSettingsPermissionService


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

    if request.method == 'GET':
        return StatusDone(IntegrationSettingService.serialize_admin_config(setting))

    if request.method == 'PUT':
        put_data, body_error = ApiRequestBodyService.parse_json_or_error(request, require_body=True)
        if body_error:
            return body_error

        try:
            with transaction.atomic():
                IntegrationSettingService.update_admin_config(setting, put_data)
                setting.save()
                AdminSettingsAuditService.record_change(
                    user=request.user,
                    target=setting,
                    change_message='Updated notification integration settings',
                )
        except IntegrationSettingConfigurationError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        return StatusDone(IntegrationSettingService.serialize_admin_config(setting))

    raise Http404
