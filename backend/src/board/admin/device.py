from django.contrib import admin

from board.models import Device


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['ip', 'agent', 'category']
    list_editable = ['category']
    list_filter = ['category']
    list_per_page = 50

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['key']
        return super().get_form(request, obj, **kwargs)