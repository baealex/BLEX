from django.contrib import admin
from django.db.models import Count

from board.models import Tag


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    actions = ['clear']
    list_display = ['value', 'count']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(count=Count('posts', distinct=True))

    def clear(self, request, queryset):
        for data in queryset:
            if data.count == 0:
                data.delete()
        self.message_user(request, str(len(queryset)) + '개의 태그중 포스트가 없는 태그 삭제')
    clear.short_description = '포스트가 없는 태그 삭제'

    def count(self, obj):
        return obj.count
    count.admin_order_field = 'count'