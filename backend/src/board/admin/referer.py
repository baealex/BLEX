from django.contrib import admin
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.db.models import Count

from board.models import Referer, RefererFrom

from .service import AdminLinkService


@admin.register(Referer)
class RefererAdmin(admin.ModelAdmin):
    list_display = ['post', 'referer_link', 'created_date']
    list_filter = ['created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('post', 'referer_from')

    def referer_link(self, obj):
        return AdminLinkService.create_referer_from_link(obj.referer_from)

    def get_fieldsets(self, request, obj=None):
        return (
            (None, {
                'fields': (
                    'created_date',
                )
            }),
        )


@admin.register(RefererFrom)
class RefererFromAdmin(admin.ModelAdmin):
    list_display = ['title_or_location', 'total_count', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(total_count=Count('referers', distinct=True))
    
    def title_or_location(self, obj):
        return obj.title if obj.title else obj.location
    title_or_location.admin_order_field = 'title'

    def total_count(self, obj):
        return obj.total_count
    total_count.admin_order_field = 'total_count'