from django.contrib import admin
from django.db.models import Count  

from board.models import Search, SearchValue


@admin.register(Search)
class SearchAdmin(admin.ModelAdmin):
    list_display = ['search_value', 'user', 'created_date']
    list_per_page = 50

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('search_value', 'user')

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['search_value', 'user', 'device']
        return super().get_form(request, obj, **kwargs)


@admin.register(SearchValue)
class SearchValueAdmin(admin.ModelAdmin):
    list_display = ['value', 'count']
    list_per_page = 50

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(count=Count('searches', distinct=True))

    def count(self, obj):
        return obj.count
    count.admin_order_field = 'count'
