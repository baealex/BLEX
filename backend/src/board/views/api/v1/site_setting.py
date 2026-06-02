from django.http import Http404
from board.models import SiteSetting
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.api_permission_service import ApiPermissionService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.agent_content_service import AgentContentService
from board.services.brand_asset_service import BrandAssetError, BrandAssetService


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
        **BrandAssetService.serialize_setting(setting),
    }


def site_settings(request):
    """
    SiteSetting GET/PUT API endpoint (staff only)

    GET /v1/site-settings - Get current site settings
    PUT /v1/site-settings - Update site settings
    """
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    setting = SiteSetting.get_instance()

    if request.method == 'GET':
        return StatusDone(serialize_site_setting(request, setting))

    if request.method == 'PUT':
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        if 'header_script' in put_data:
            setting.header_script = put_data['header_script']

        if 'footer_script' in put_data:
            setting.footer_script = put_data['footer_script']

        if 'site_name' in put_data:
            site_name = put_data['site_name']
            normalized_site_name = site_name.strip() if isinstance(site_name, str) else ''
            if len(normalized_site_name) > 80:
                return StatusError(ErrorCode.VALIDATE, '사이트 이름은 80자 이하여야 합니다.')
            setting.site_name = normalized_site_name or BrandAssetService.DEFAULT_SITE_NAME

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


def site_setting_brand_assets(request):
    permission_error = ApiPermissionService.require_staff(request.user)
    if permission_error:
        return permission_error

    setting = SiteSetting.get_instance()

    if request.method == 'POST':
        try:
            BrandAssetService.upload_asset(
                setting,
                asset_type=request.POST.get('asset_type', ''),
                theme=request.POST.get('theme', ''),
                svg_file=request.FILES.get('svg'),
                files=request.FILES,
                manifest_raw=request.POST.get('manifest', ''),
            )
        except BrandAssetError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        return StatusDone(serialize_site_setting(request, setting))

    if request.method == 'DELETE':
        data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
        try:
            BrandAssetService.delete_asset(
                setting,
                asset_type=data.get('asset_type', request.GET.get('asset_type', '')),
                theme=data.get('theme', request.GET.get('theme', '')),
            )
        except BrandAssetError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        return StatusDone(serialize_site_setting(request, setting))

    raise Http404
