from django.contrib import admin

from board.models import Report

from .service import AdminLinkService


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'post_link', 'content_link', 'config_link', 'content', 'created_date']
    list_per_page = 50

    def post_link(self, obj):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = 'post'
    
    def content_link(self, obj):
        return AdminLinkService.create_post_content_link(obj.post.content)
    content_link.short_description = 'content'
    
    def config_link(self, obj):
        return AdminLinkService.create_post_config_link(obj.post.config)
    config_link.short_description = 'config'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'post', 'device']
        return super().get_form(request, obj, **kwargs)
