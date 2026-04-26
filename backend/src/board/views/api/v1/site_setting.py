import json
from django.http import Http404
from board.models import SiteSetting
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.services.agent_content_service import AgentContentService


def serialize_site_setting(request, setting):
    return {
        'header_script': setting.header_script,
        'footer_script': setting.footer_script,
        'welcome_notification_message': setting.welcome_notification_message,
        'welcome_notification_url': setting.welcome_notification_url,
        'account_deletion_redirect_url': setting.account_deletion_redirect_url,
        'seo_enabled': setting.seo_enabled,
        'robots_txt_extra_rules': setting.robots_txt_extra_rules,
        'robots_txt_default': AgentContentService.build_default_robots_txt(request, setting),
        'aeo_enabled': setting.aeo_enabled,
        'updated_date': setting.updated_date.isoformat(),
    }


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
        return StatusDone(serialize_site_setting(request, setting))

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

        if 'seo_enabled' in put_data:
            setting.seo_enabled = put_data['seo_enabled'] is True

        if 'robots_txt_extra_rules' in put_data:
            extra_rules = put_data['robots_txt_extra_rules']
            setting.robots_txt_extra_rules = extra_rules if isinstance(extra_rules, str) else ''

        if 'aeo_enabled' in put_data:
            setting.aeo_enabled = put_data['aeo_enabled'] is True

        setting.save()

        return StatusDone(serialize_site_setting(request, setting))

    raise Http404
