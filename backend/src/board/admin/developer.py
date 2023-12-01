from django.contrib import admin

from board.models import DeveloperToken, DeveloperRequestLog


@admin.register(DeveloperToken)
class DeveloperTokenAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'token']
        return super().get_form(request, obj, **kwargs)


@admin.register(DeveloperRequestLog)
class DeveloperRequestLogAdmin(admin.ModelAdmin):
    list_display = ['developer', 'endpoint', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)