from django.contrib import admin
from django.urls import reverse
from django.utils.safestring import mark_safe

from board.models import Form

from .service import AdminLinkService


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'title', 'is_public', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)