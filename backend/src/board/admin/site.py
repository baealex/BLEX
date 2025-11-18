from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse
from django.http import HttpResponse
from django import forms

from board.models import SiteSetting, StaticPage


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
        ('회원가입 알림 설정', {
            'description': '회원가입 시 자동으로 발송될 환영 알림을 설정합니다.',
            'fields': ('welcome_notification_message', 'welcome_notification_url')
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


class StaticPageAdminForm(forms.ModelForm):
    """Custom form for StaticPage with rich text editor styling"""
    content = forms.CharField(
        widget=forms.Textarea(attrs={
            'rows': 20,
            'style': 'width: 100%; font-family: monospace; font-size: 14px;'
        }),
        help_text='HTML 태그를 사용할 수 있습니다. (예: <h1>, <p>, <div>, <section> 등)'
    )

    class Meta:
        model = StaticPage
        fields = '__all__'


@admin.register(StaticPage)
class StaticPageAdmin(admin.ModelAdmin):
    """
    Admin interface for static pages.
    Allows creating and editing static pages with HTML content.
    """
    form = StaticPageAdminForm
    list_display = ['title', 'slug', 'is_published', 'show_in_footer', 'order', 'updated_date']
    list_editable = ['is_published', 'show_in_footer', 'order']
    list_filter = ['is_published', 'show_in_footer']
    search_fields = ['title', 'slug', 'content']
    prepopulated_fields = {'slug': ('title',)}

    fieldsets = (
        ('기본 정보', {
            'fields': ('title', 'slug', 'meta_description')
        }),
        ('페이지 내용', {
            'fields': ('content',),
            'description': 'HTML 코드를 작성하여 페이지를 디자인할 수 있습니다. Tailwind CSS 클래스를 사용할 수 있습니다.'
        }),
        ('표시 설정', {
            'fields': ('is_published', 'show_in_footer', 'order')
        }),
        ('메타데이터', {
            'fields': ('author', 'created_date', 'updated_date'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = ['created_date', 'updated_date']

    def save_model(self, request, obj, form, change):
        if not obj.author:
            obj.author = request.user
        super().save_model(request, obj, form, change)
