from django.contrib import admin
from django.db.models import Count

from board.models import Referer, RefererFrom
from modules.scrap import page_parser

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

    def has_add_permission(self, request):
        return False

    def get_form(self, request, obj: Referer, **kwargs):
        if obj:
            kwargs['exclude'] = ['post', 'analytics', 'referer_from']
        return super().get_form(request, obj, **kwargs)
    

@admin.register(RefererFrom)
class RefererFromAdmin(admin.ModelAdmin):
    actions = ['clear', 'collect']

    list_display = ['title_or_location', 'total_count', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(total_count=Count('referers', distinct=True))
    
    def clear(self, request, queryset):
        count = 0
        for data in queryset:
            if data.total_count == 0:
                count += 1
                data.delete()
        self.message_user(request, f'{len(queryset)}개의 레퍼러중 참조가 없는 {count}개의 레퍼러 삭제')
    clear.short_description = '참조가 없는 소스 삭제'

    def collect(self, request, queryset):
        count = 0
        for referer_from in queryset:
            if not referer_from.title and not referer_from.image and not referer_from.description:
                count += 1
                data = page_parser(referer_from.location)
                if data['title']:
                    referer_from.title = data['title']
                if data['image']:
                    referer_from.image = data['image']
                if data['description']:
                    referer_from.description = data['description']
                referer_from.update()
        self.message_user(request, f'{len(queryset)}개의 레퍼러중 {count}개의 레퍼러 수집')
    collect.short_description = '레퍼러 정보 수집'

    def title_or_location(self, obj):
        return obj.title if obj.title else obj.location
    title_or_location.admin_order_field = 'title'

    def total_count(self, obj):
        return obj.total_count
    total_count.admin_order_field = 'total_count'
