from django.http import Http404

from board.models import LoginSetting
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.hcaptcha_service import HCaptchaConfigurationError, HCaptchaService
from board.services.social_auth_provider_service import SocialAuthProviderService


def serialize_login_setting(setting):
    return {
        'welcome_notification_message': setting.welcome_notification_message,
        'welcome_notification_url': setting.welcome_notification_url,
        'account_deletion_redirect_url': setting.account_deletion_redirect_url,
        'updated_date': setting.updated_date.isoformat(),
        'social_auth_providers': SocialAuthProviderService.serialize_admin_providers(),
        **HCaptchaService.serialize_admin_config(setting),
    }


def login_settings(request):
    """
    LoginSetting GET/PUT API endpoint (staff only)

    GET /v1/login-settings - Get current login settings
    PUT /v1/login-settings - Update login settings
    """
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    setting = LoginSetting.get_instance()

    if request.method == 'GET':
        return StatusDone(serialize_login_setting(setting))

    if request.method == 'PUT':
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        if 'welcome_notification_message' in put_data:
            setting.welcome_notification_message = put_data['welcome_notification_message']

        if 'welcome_notification_url' in put_data:
            setting.welcome_notification_url = put_data['welcome_notification_url']

        if 'account_deletion_redirect_url' in put_data:
            setting.account_deletion_redirect_url = put_data['account_deletion_redirect_url']

        try:
            HCaptchaService.update_admin_config(setting, put_data)
        except HCaptchaConfigurationError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        if 'social_auth_providers' in put_data:
            SocialAuthProviderService.update_admin_providers(put_data['social_auth_providers'])

        setting.save()

        return StatusDone(serialize_login_setting(setting))

    raise Http404
