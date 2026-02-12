from django.contrib import admin
from django.conf import settings

from board.models import ImageCache

from .service import AdminDisplayService


class ImageFilter(admin.SimpleListFilter):
    title = '이미지 타입'
    parameter_name = 'image_type'

    def lookups(self, request, model_admin):
        return (
            ('jpeg', 'JPEG'),
            ('jpg', 'JPG'),
            ('png', 'PNG'),
            ('gif', 'GIF'),
            ('mp4', 'MP4'),
        )

    def queryset(self, request, queryset):
        if self.value() == None:
            return queryset
        return queryset.filter(path__endswith=f'.{self.value()}')


@admin.register(ImageCache)
class ImageCacheAdmin(admin.ModelAdmin):
    search_fields = ['path']

    list_display = ['id', 'file_size', 'image', 'open_image']
    list_per_page = 50

    def get_list_filter(self, request):
        return [ImageFilter]

    def file_size(self, obj):
        size = obj.size
        if size > 1024 * 1024:
            return f'{round(size / 1024 / 1024, 2)} MB'
        elif size > 1024:
            return f'{round(size / 1024, 2)} KB'
        return f'{size} B'
    file_size.short_description = '파일 크기'
    file_size.admin_order_field = 'size'

    def image(self, obj):
        image_size = '480px'
        media_path = settings.MEDIA_URL + obj.path

        if obj.path.endswith('.mp4'):
            return AdminDisplayService.video(media_path, image_size)
        return AdminDisplayService.image(media_path, image_size)
    image.short_description = '미리보기'
    image.admin_order_field = 'path'

    def open_image(self, obj):
        return AdminDisplayService.link(settings.MEDIA_URL + obj.path)
    open_image.short_description = '열기'