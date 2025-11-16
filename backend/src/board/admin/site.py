from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse
from django.http import HttpResponse

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
        try:
            return not SiteSetting.objects.exists()
        except Exception:
            # If table doesn't exist, allow creation (after migration)
            return True

    def has_delete_permission(self, request, obj=None):
        # Don't allow deletion
        return False

    def changelist_view(self, request, extra_context=None):
        # Redirect to the single instance edit page
        try:
            # Try to get existing instance first, create only if it doesn't exist
            obj = SiteSetting.objects.filter(pk=1).first()
            if obj is None:
                obj = SiteSetting.objects.create(pk=1, header_script='', footer_script='')

            # Use reverse to get the correct admin URL
            url = reverse('admin:board_sitesetting_change', args=[obj.pk])
            return redirect(url)
        except Exception as e:
            # If table doesn't exist yet (migrations not run), show error
            return HttpResponse(
                f'<p>Error: {str(e)}</p>',
                status=503
            )
