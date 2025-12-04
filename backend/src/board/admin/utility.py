"""
Utility Admin Module
관리자가 유틸리티 기능을 웹 인터페이스로 실행할 수 있도록 제공
"""
from django.contrib import admin
from django.urls import path
from django.contrib.admin.models import LogEntry

from .utilities import views


class UtilityAdmin(admin.ModelAdmin):
    """유틸리티 관리 어드민"""

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('dashboard/', self.admin_site.admin_view(self.utility_dashboard_view), name='utility_dashboard'),
            path('clean-images/', self.admin_site.admin_view(self.clean_images_view), name='clean_images'),
            path('clean-logs/', self.admin_site.admin_view(self.clean_logs_view), name='clean_logs'),
            path('validate-html/', self.admin_site.admin_view(self.validate_html_view), name='validate_html'),
        ]
        return custom_urls + urls

    def utility_dashboard_view(self, request):
        """유틸리티 대시보드"""
        return views.utility_dashboard_view(self.admin_site, request)

    def clean_images_view(self, request):
        """이미지 정리"""
        return views.clean_images_view(self.admin_site, request)

    def clean_logs_view(self, request):
        """로그 정리"""
        return views.clean_logs_view(self.admin_site, request)

    def validate_html_view(self, request):
        """HTML 태그 검증 및 수정"""
        return views.validate_html_view(self.admin_site, request)


# 더미 모델 (URL 라우팅을 위한)
class UtilityProxy(LogEntry):
    class Meta:
        proxy = True
        verbose_name = '유틸리티 관리'
        verbose_name_plural = '유틸리티 관리'


# Admin 등록
@admin.register(UtilityProxy)
class UtilityProxyAdmin(UtilityAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def changelist_view(self, request, extra_context=None):
        # 리스트 뷰 대신 대시보드로 리다이렉트
        from django.shortcuts import redirect
        from django.urls import reverse
        return redirect(reverse('admin:utility_dashboard'))
