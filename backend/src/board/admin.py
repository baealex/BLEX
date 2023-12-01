from django.contrib import admin
from django.contrib.admin.models import LogEntry
from django.db.models import F, Count
from django.urls import reverse
from django.utils.safestring import mark_safe    

from .models import *


admin.site.register(LogEntry)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'author_link', 'post_link', 'content', 'created_date']
    list_display_links = ['content']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post')
    
    def author_link(self, obj):
        if obj.author:
            return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.author.id,)), obj.author.username))
        return None
    author_link.short_description = 'author'

    def post_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_post_change', args=(obj.post.id,)), obj.post.title))
    post_link.short_description = 'post'

    def content(self, obj):
        return truncatewords(strip_tags(obj.text_html), 5)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(EmailChange)
class EmailChangeAdmin(admin.ModelAdmin):
    list_display = ['user', 'email', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(UserConfigMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user_link', 'name', 'value']
    list_display_links = ['name']
    list_filter = ['name']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user']
    list_per_page = 30


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ['id', 'to_link', 'from_link', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            from_id=F('follower__id'),
            from_username=F('follower__username'),
            to_id=F('following__user__id'),
            to_username=F('following__user__username'),
        )

    def to_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.to_id,)), obj.to_username))
    to_link.short_description = 'to'

    def from_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.from_id,)), obj.from_username))
    from_link.short_description = 'from'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['following', 'follower']
        return super().get_form(request, obj, **kwargs)


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'title', 'is_public', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Device)
class DeviceAdmin(admin.ModelAdmin):
    list_display = ['ip', 'agent', 'category']
    list_editable = ['category']
    list_filter = ['category']
    list_per_page = 50

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['key']
        return super().get_form(request, obj, **kwargs)


class ImageFilter(admin.SimpleListFilter):
    title = 'image type'
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
    list_display = ['id', 'file_size', 'image', 'open_image']
    list_per_page = 50

    def get_list_filter(self, request):
        return [ImageFilter]

    def file_size(self, obj):
        size = obj.size
        if size > 1024 * 1024:
            return f'{round(size / 1024 / 1024, 2)} mb'
        elif size > 1024:
            return f'{round(size / 1024, 2)} kb'
        return f'{size} b'
    file_size.short_description = 'size'
    file_size.admin_order_field = 'size'

    def image(self, obj):
        image_size = '480px'
        media_path = settings.MEDIA_URL + obj.path

        if obj.path.endswith('.mp4'):
            return mark_safe('<video src="{}" controls autoplay loop muted playsinline width="{}"></video>'.format(media_path, image_size))
        return mark_safe('<img src="{}" lazy="loading" width="{}"/>'.format(media_path, image_size))
    image.admin_order_field = 'path'

    def open_image(self, obj):
        return mark_safe('<a href="{}" target="_blank">🔗</a>'.format(settings.MEDIA_URL + obj.path))
    open_image.short_description = 'open'


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', '_content', 'has_read', 'created_date']
    list_display_links = ['_content']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def _content(self, obj):
        return truncatewords(obj.content, 8)
    _content.short_description = 'content'

    def save_model(self, request, obj: Notify, form, change):
        obj.key = Notify.create_hash_key(user=obj.user, url=obj.url, content=obj.content)
        if Notify.objects.filter(key=obj.key).exists():
            return

        super().save_model(request, obj, form, change)
        obj.send_notify()
    
    def get_fieldsets(self, request, obj: Notify):
        return (
            (None, {
                'fields': (
                    'user',
                    'url',
                    'content',
                    'has_read',
                )
            }),
        )


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


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author_link', 'title', 'series_link', 'content_link', 'config_link', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'content', 'config', 'series')

    def author_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.author.id,)), obj.author.username))
    author_link.short_description = 'author'

    def content_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postcontent_change', args=(obj.content.id,)), '🚀'))
    content_link.short_description = 'content'
    
    def config_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postconfig_change', args=(obj.config.id,)), '🚀'))
    config_link.short_description = 'config'
    
    def series_link(self, obj):
        if obj.series:
            return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_series_change', args=(obj.series.id,)), obj.series.name))
        return None
    series_link.short_description = 'series'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'series', 'tags']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostConfig)
class PostConfigAdmin(admin.ModelAdmin):
    list_display = ['id']
    list_per_page = 100

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['post']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostContent)
class PostContentAdmin(admin.ModelAdmin):
    list_display = ['id']
    list_per_page = 100

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['post', 'author', 'series', 'tags']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostAnalytics)
class PostAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['post', 'today', 'created_date']
    list_filter = ['created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(today=Count('devices', distinct=True))

    def today(self, obj):
        return obj.today

    today.admin_order_field = 'today'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['post', 'devices']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostLikes)
class PostLikesAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'homepage', 'bio']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Referer)
class RefererAdmin(admin.ModelAdmin):
    list_display = ['post', 'referer_link', 'created_date']
    list_filter = ['created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('post', 'referer_from')

    def referer_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_refererfrom_change', args=(obj.referer_from.id,)), obj.referer_from.title if obj.referer_from.title else obj.referer_from.location))

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


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'post_link', 'content_link', 'config_link', 'content', 'created_date']
    list_per_page = 50

    def post_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_post_change', args=(obj.post.id,)), obj.post.title))
    post_link.short_description = 'post'
    
    def content_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postcontent_change', args=(obj.post.content.id,)), '🚀'))
    content_link.short_description = 'content'
    
    def config_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:board_postconfig_change', args=(obj.post.config.id,)), '🚀'))
    config_link.short_description = 'config'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'post', 'device']
        return super().get_form(request, obj, **kwargs)


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


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['owner_link', 'name', 'count_posts', 'created_date']
    list_display_links = ['name']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('owner').annotate(count_posts=Count('posts', distinct=True))

    def owner_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.owner.id,)), obj.owner.username))

    def count_posts(self, obj):
        return obj.count_posts
    count_posts.admin_order_field = 'count_posts'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['owner']
        return super().get_form(request, obj, **kwargs)


@admin.register(TempPosts)
class TempPostsAdmin(admin.ModelAdmin):
    list_display = ['author_link', 'title', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author')

    def author_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.author.id,)), obj.author.username))
    author_link.short_description = 'author'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'token']
        return super().get_form(request, obj, **kwargs)


@admin.register(TelegramSync)
class TelegramSyncAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'synced', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def synced(self, obj):
        return '✅' if obj.tid else '❌'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(TwoFactorAuth)
class TwoFactorAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


admin.site.register(EditHistory)
admin.site.register(EditRequest)


@admin.register(PostThanks)
class PostThanksAdmin(admin.ModelAdmin):
    list_display = ['post', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['device', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostNoThanks)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['post', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['device', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(UserLinkMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


admin.site.register(UsernameChangeLog)


@admin.register(OpenAIConnection)
class OpenAIConnectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'api_key']
        return super().get_form(request, obj, **kwargs)


@admin.register(OpenAIUsageHistory)
class OpenAIUsageHistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user_link', 'query_size', 'response_size', 'created_date']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')
    
    def user_link(self, obj):
        return mark_safe('<a href="{}">{}</a>'.format(reverse('admin:auth_user_change', args=(obj.user.id,)), obj.user.username))
    user_link.short_description = 'user'

    def query_size(self, obj):
        return len(obj.query)

    def response_size(self, obj):
        return len(obj.response)

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


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


@admin.register(SocialAuth)
class SocialAuthAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'provider', 'uid']
        return super().get_form(request, obj, **kwargs)


@admin.register(SocialAuthProvider)
class SocialAuthProviderAdmin(admin.ModelAdmin):
    list_display = ['key', 'name', 'icon', 'color']
    list_editable = ['name', 'icon', 'color']
