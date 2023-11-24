from django.contrib import admin

from .models import *


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['created_date', 'author', 'post']
    list_per_page = 30

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
class FormAdmin(admin.ModelAdmin):
    list_display = ['value', 'count']
    list_per_page = 30

    def count(self, obj):
        return obj.post.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author', 'title', 'read_time', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'series']
        return super().get_form(request, obj, **kwargs)


admin.site.register(PostContent)
admin.site.register(PostConfig)


@admin.register(PostAnalytics)
class PostAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['post', 'view_count', 'created_date']
    list_filter = ['created_date']
    list_per_page = 30

    def view_count(self, obj):
        return obj.table.count()

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['post', 'table']
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
    list_display = ['created_date', 'post', 'referer']
    list_display_links = ['post']

    def referer(self, obj):
        return obj.referer_from.title if obj.referer_from.title else obj.referer_from.location

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
    list_display = ['total_count', 'title', 'location']

    def total_count(self, obj):
        return obj.referers.count()


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'content', 'created_date']
    list_per_page = 50

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'post', 'device']
        return super().get_form(request, obj, **kwargs)


@admin.register(Search)
class SearchAdmin(admin.ModelAdmin):
    list_display = ['search_value', 'user', 'created_date']
    list_per_page = 50

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['search_value', 'user', 'device']
        return super().get_form(request, obj, **kwargs)


admin.site.register(SearchValue)


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['owner', 'name', 'post_count', 'created_date']

    def post_count(self, obj):
        return obj.post.count()

    actions = ['hide']

    def hide(self, request, queryset):
        for data in queryset:
            data.hide = True
            data.save()
        self.message_user(request, str(len(queryset)) + '개의 시리즈 숨김')

    hide.short_description = '숨기기'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(TempPosts)
class TempPostsAdmin(admin.ModelAdmin):
    list_display = ['author', 'title', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_filter = ['author']
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
    list_display = ['post', 'created_date', 'device']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['device', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostNoThanks)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['post', 'created_date', 'device']

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
