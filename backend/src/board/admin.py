from django.contrib import admin
from django.urls import reverse
from django.utils.safestring import mark_safe    

from .models import *
from django.contrib.admin.models import LogEntry


admin.site.register(LogEntry)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author', 'post', 'created_date']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'post')

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
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user']
    list_per_page = 30


@admin.register(Follow)
class FormAdmin(admin.ModelAdmin):
    list_display = ['following', 'follower']
    list_per_page = 30

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['following', 'follower']
        return super().get_form(request, obj, **kwargs)


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title']
    list_per_page = 30

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


@admin.register(ImageCache)
class ImageCacheAdmin(admin.ModelAdmin):
    list_display = ['id', 'path']
    list_per_page = 50


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['user', 'content', 'created_date', 'has_read']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'key']
        return super().get_form(request, obj, **kwargs)


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


admin.site.register(SearchValue)


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
    list_display = ['author', 'title', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'token']
        return super().get_form(request, obj, **kwargs)


@admin.register(TelegramSync)
class TelegramSyncAdmin(admin.ModelAdmin):
    list_display = ['user', 'tid', 'created_date']

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
    list_display = ['user', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'api_key']
        return super().get_form(request, obj, **kwargs)


@admin.register(OpenAIUsageHistory)
class OpenAIUsageHistoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'created_date']

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
