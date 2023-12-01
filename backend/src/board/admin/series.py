from django.contrib import admin
from django.db.models import Count
from django.urls import reverse
from django.utils.safestring import mark_safe

from board.models import Series

from .service import AdminLinkService


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['owner_link', 'name', 'count_posts', 'created_date']
    list_display_links = ['name']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('owner').annotate(count_posts=Count('posts', distinct=True))

    def owner_link(self, obj):
        return AdminLinkService.create_user_link(obj.owner)

    def count_posts(self, obj):
        return obj.count_posts
    count_posts.admin_order_field = 'count_posts'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['owner']
        return super().get_form(request, obj, **kwargs)
