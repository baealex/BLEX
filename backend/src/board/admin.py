from django.contrib import admin

from .models import *


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = [
        'created_date',
        'author',
        'post',
        'text_md'
    ]
    list_filter = ['author']
    list_per_page = 30


@admin.register(Follow)
class FormAdmin(admin.ModelAdmin):
    list_display = ['following', 'follower']


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title']


@admin.register(History)
class HistoryAdmin(admin.ModelAdmin):
    list_display = [
        'ip',
        'agent',
        'category'
    ]
    list_editable = ['category']
    list_filter = ['category']
    list_per_page = 100

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['key']
        return super().get_form(request, obj, **kwargs)


@admin.register(ImageCache)
class ImageCacheAdmin(admin.ModelAdmin):
    list_display = ['id', 'path']
    list_per_page = 50


@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['user', 'infomation', 'created_date', 'is_read']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'key']
        return super().get_form(request, obj, **kwargs)


@admin.register(Tag)
class FormAdmin(admin.ModelAdmin):
    list_display = ['value', 'count']
    list_per_page = 30

    def count(self, obj):
        return obj.posts.count()


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author', 'title', 'read_time', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_filter = ['author']
    list_per_page = 30


admin.site.register(PostContent)
admin.site.register(PostConfig)


@admin.register(PostAnalytics)
class PostAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['posts', 'view_count', 'created_date']
    list_filter = ['created_date']
    list_per_page = 30

    def view_count(self, obj):
        return obj.table.count()

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['posts', 'table']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostLikes)
class PostLikesAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'subscriber']

    def subscriber(self, obj):
        return obj.total_subscriber()

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user']


@admin.register(Referer)
class RefererAdmin(admin.ModelAdmin):
    list_display = ['created_date', 'posts', 'referer']
    list_display_links = ['posts']

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
    list_display = ['posts', 'content', 'created_date']
    list_per_page = 10


@admin.register(Search)
class SearchAdmin(admin.ModelAdmin):
    list_display = ['search_value', 'user', 'created_date']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['search_value', 'user', 'searcher']
        return super().get_form(request, obj, **kwargs)


admin.site.register(SearchValue)


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['owner', 'name', 'posts_count', 'created_date']

    def posts_count(self, obj):
        return obj.posts.count()

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
    list_display = ['post', 'created_date', 'history']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['history', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(PostNoThanks)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['post', 'created_date', 'history']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['history', 'post']
        return super().get_form(request, obj, **kwargs)


@admin.register(UserConfigMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)
    

@admin.register(UserLinkMeta)
class PostNoThanksAdmin(admin.ModelAdmin):
    list_display = ['user', 'name', 'value']

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


admin.site.register(UsernameChangeLog)
