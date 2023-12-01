from django.contrib import admin
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.template.defaultfilters import truncatewords

from board.models import Notify

from .service import AdminLinkService


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', '_content', 'has_read', 'created_date']
    list_display_links = ['_content']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def _content(self, obj):
        return truncatewords(obj.content, 8)
    _content.short_description = 'content'

    def save_model(self, request, obj: Notify, form, change):
        obj.key = Notify.create_hash_key(user=obj.user, url=obj.url, content=obj.content)
        if Notify.objects.filter(key=obj.key).exists():
            return

        super().save_model(request, obj, form, change)
        obj.send_notify()
    
    def get_fieldsets(self, request, obj: Notify):
        return (
            (None, {
                'fields': (
                    'user',
                    'url',
                    'content',
                    'has_read',
                )
            }),
        )