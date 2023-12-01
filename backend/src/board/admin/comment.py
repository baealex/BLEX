from django.contrib import admin
from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

from board.models import Comment

from .service import AdminLinkService


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'author_link', 'post_link', 'content', 'created_date']
    list_display_links = ['content']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post')
    
    def author_link(self, obj):
        if obj.author:
            return AdminLinkService.create_user_link(obj.author)
        return None
    author_link.short_description = 'author'

    def post_link(self, obj):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = 'post'

    def content(self, obj):
        return truncatewords(strip_tags(obj.text_html), 5)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'post']
        return super().get_form(request, obj, **kwargs)