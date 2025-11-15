from django.contrib import admin
from board.models import SiteSetting


@admin.register(SiteSetting)
class SiteSettingAdmin(admin.ModelAdmin):
    """
    Admin interface for site-wide settings.
    Only accessible by superusers.
    """
    fieldsets = (
        ('사이트 전체 분석 스크립트', {
            'description': '사이트 전체에 적용될 분석 스크립트를 설정합니다. (Google Analytics, Umami 등)',
            'fields': ('header_script', 'footer_script')
        }),
        ('메타데이터', {
            'fields': ('updated_date',),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['updated_date']

    def has_add_permission(self, request):
        # Only allow one instance (singleton)
        return not SiteSetting.objects.exists()

    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion
        return False

    def changelist_view(self, request, extra_context=None):
        # Redirect to the single instance edit page
        obj = SiteSetting.get_instance()
        from django.shortcuts import redirect
        return redirect(f'/admin/board/sitesetting/{obj.pk}/change/')
