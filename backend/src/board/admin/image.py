from django.contrib import admin
from django.conf import settings
from django.utils.translation import gettext_lazy as _

from board.models import ImageCache

from .mixins import ServiceOwnedRecordAdminMixin
from .service import AdminDisplayService, AdminLinkService


class ImageFilter(admin.SimpleListFilter):
    title = _('Image type')
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
class ImageCacheAdmin(ServiceOwnedRecordAdminMixin, admin.ModelAdmin):
    search_fields = ['path']

    list_display = ['id', 'user_link', 'file_size', 'image', 'open_image']
    fields = ['user_link', 'path', 'file_size', 'image', 'open_image']
    readonly_fields = fields
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').defer(
            'key',
            'user__password',
        )

    def get_list_filter(self, request):
        return [ImageFilter]

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('Uploader')
    user_link.admin_order_field = 'user__username'

    def file_size(self, obj):
        size = obj.size
        if size > 1024 * 1024:
            return f'{round(size / 1024 / 1024, 2)} MB'
        elif size > 1024:
            return f'{round(size / 1024, 2)} KB'
        return f'{size} B'
    file_size.short_description = _('File size')
    file_size.admin_order_field = 'size'

    def image(self, obj):
        image_size = '120px'
        media_path = settings.MEDIA_URL + obj.path

        if obj.path.endswith('.mp4'):
            return AdminDisplayService.video(media_path, image_size)
        return AdminDisplayService.image(media_path, image_size)
    image.short_description = _('Preview')
    image.admin_order_field = 'path'

    def open_image(self, obj):
        return AdminDisplayService.link(settings.MEDIA_URL + obj.path)
    open_image.short_description = _('Open')
