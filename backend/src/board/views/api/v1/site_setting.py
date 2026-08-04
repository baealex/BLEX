from django.db import transaction
from django.http import Http404
from django.utils.translation import gettext as _

from board.models import SiteSetting
from board.modules.response import ErrorCode, StatusDone, StatusError
from board.services.admin_settings_audit_service import AdminSettingsAuditService
from board.services.api_request_body_service import ApiRequestBodyService
from board.services.agent_content_service import AgentContentService
from board.services.brand_asset_service import BrandAssetError, BrandAssetService
from board.services.product_settings_permission_service import ProductSettingsPermissionService


GLOBAL_CODE_FIELDS = frozenset({'header_script', 'footer_script'})


def serialize_site_setting(request, setting):
    can_manage_scripts = ProductSettingsPermissionService.can_manage_global_code(
        request.user,
    )

    return {
        'header_script': setting.header_script if can_manage_scripts else '',
        'footer_script': setting.footer_script if can_manage_scripts else '',
        'can_manage_scripts': can_manage_scripts,
        'seo_enabled': setting.seo_enabled,
        'robots_txt_extra_rules': setting.robots_txt_extra_rules,
        'robots_txt_default': AgentContentService.build_default_robots_txt(request, setting),
        'aeo_enabled': setting.aeo_enabled,
        'updated_date': setting.updated_date.isoformat(),
        **BrandAssetService.serialize_setting(setting),
    }


def site_settings(request):
    """
    SiteSetting GET/PUT API endpoint.

    GET /v1/site-settings - Get current site settings
    PUT /v1/site-settings - Update site settings
    """
    permission_error = ProductSettingsPermissionService.require_site_settings(
        request.user,
    )
    if permission_error:
        return permission_error

    setting = SiteSetting.get_instance()

    if request.method == 'GET':
        return StatusDone(serialize_site_setting(request, setting))

    if request.method == 'PUT':
        put_data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)

        if GLOBAL_CODE_FIELDS.intersection(put_data):
            global_code_error = ProductSettingsPermissionService.require_global_code(
                request.user,
            )
            if global_code_error:
                return global_code_error

        if 'site_name' in put_data:
            site_name = put_data['site_name']
            normalized_site_name = site_name.strip() if isinstance(site_name, str) else ''
            if len(normalized_site_name) > 80:
                return StatusError(
                    ErrorCode.VALIDATE,
                    _('Site name must be 80 characters or fewer.'),
                )

        with transaction.atomic():
            setting = SiteSetting.objects.select_for_update().get(pk=setting.pk)
            update_fields = ['updated_date']

            if 'header_script' in put_data:
                setting.header_script = put_data['header_script']
                update_fields.append('header_script')

            if 'footer_script' in put_data:
                setting.footer_script = put_data['footer_script']
                update_fields.append('footer_script')

            if 'site_name' in put_data:
                setting.site_name = normalized_site_name or BrandAssetService.DEFAULT_SITE_NAME
                update_fields.append('site_name')

            if 'seo_enabled' in put_data:
                setting.seo_enabled = put_data['seo_enabled'] is True
                update_fields.append('seo_enabled')

            if 'robots_txt_extra_rules' in put_data:
                extra_rules = put_data['robots_txt_extra_rules']
                setting.robots_txt_extra_rules = extra_rules if isinstance(extra_rules, str) else ''
                update_fields.append('robots_txt_extra_rules')

            if 'aeo_enabled' in put_data:
                setting.aeo_enabled = put_data['aeo_enabled'] is True
                update_fields.append('aeo_enabled')

            setting.save(update_fields=update_fields)
            AdminSettingsAuditService.record_change(
                user=request.user,
                target=setting,
                change_message='Updated site settings',
            )

        return StatusDone(serialize_site_setting(request, setting))

    raise Http404


def site_setting_brand_assets(request):
    permission_error = ProductSettingsPermissionService.require_site_settings(
        request.user,
    )
    if permission_error:
        return permission_error

    setting = SiteSetting.get_instance()

    if request.method == 'POST':
        try:
            with transaction.atomic():
                setting = SiteSetting.objects.select_for_update().get(pk=setting.pk)
                BrandAssetService.upload_asset(
                    setting,
                    asset_type=request.POST.get('asset_type', ''),
                    theme=request.POST.get('theme', ''),
                    svg_file=request.FILES.get('svg'),
                    files=request.FILES,
                    manifest_raw=request.POST.get('manifest', ''),
                    on_persist=lambda changed_setting: AdminSettingsAuditService.record_change(
                        user=request.user,
                        target=changed_setting,
                        change_message='Uploaded a brand asset',
                    ),
                )
        except BrandAssetError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        return StatusDone(serialize_site_setting(request, setting))

    if request.method == 'DELETE':
        data = ApiRequestBodyService.parse_json_or_empty_for_legacy_only(request)
        try:
            with transaction.atomic():
                setting = SiteSetting.objects.select_for_update().get(pk=setting.pk)
                BrandAssetService.delete_asset(
                    setting,
                    asset_type=data.get('asset_type', request.GET.get('asset_type', '')),
                    theme=data.get('theme', request.GET.get('theme', '')),
                    on_persist=lambda changed_setting: AdminSettingsAuditService.record_change(
                        user=request.user,
                        target=changed_setting,
                        change_message='Deleted a brand asset',
                    ),
                )
        except BrandAssetError as error:
            return StatusError(ErrorCode.VALIDATE, error.message)

        return StatusDone(serialize_site_setting(request, setting))

    raise Http404
