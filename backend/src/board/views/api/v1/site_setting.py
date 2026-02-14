import json
from django.http import Http404
from board.models import SiteSetting
from board.modules.response import StatusDone, StatusError, ErrorCode


def site_settings(request):
    """
    SiteSetting GET/PUT API endpoint (staff only)

    GET /v1/site-settings - Get current site settings
    PUT /v1/site-settings - Update site settings
    """
    if not request.user.is_active:
        return StatusError(ErrorCode.NEED_LOGIN)

    if not request.user.is_staff:
        return StatusError(ErrorCode.REJECT, '관리자 권한이 필요합니다.')

    setting = SiteSetting.get_instance()

    if request.method == 'GET':
        return StatusDone({
            'header_script': setting.header_script,
            'footer_script': setting.footer_script,
            'welcome_notification_message': setting.welcome_notification_message,
            'welcome_notification_url': setting.welcome_notification_url,
            'account_deletion_redirect_url': setting.account_deletion_redirect_url,
            'updated_date': setting.updated_date.isoformat(),
        })

    if request.method == 'PUT':
        try:
            put_data = json.loads(request.body.decode('utf-8')) if request.body else {}
        except (json.JSONDecodeError, UnicodeDecodeError):
            put_data = {}

        if 'header_script' in put_data:
            setting.header_script = put_data['header_script']

        if 'footer_script' in put_data:
            setting.footer_script = put_data['footer_script']

        if 'welcome_notification_message' in put_data:
            setting.welcome_notification_message = put_data['welcome_notification_message']

        if 'welcome_notification_url' in put_data:
            setting.welcome_notification_url = put_data['welcome_notification_url']

        if 'account_deletion_redirect_url' in put_data:
            setting.account_deletion_redirect_url = put_data['account_deletion_redirect_url']

        setting.save()

        return StatusDone({
            'header_script': setting.header_script,
            'footer_script': setting.footer_script,
            'welcome_notification_message': setting.welcome_notification_message,
            'welcome_notification_url': setting.welcome_notification_url,
            'account_deletion_redirect_url': setting.account_deletion_redirect_url,
            'updated_date': setting.updated_date.isoformat(),
        })

    raise Http404
