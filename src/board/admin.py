from django.contrib import admin

from.models import *

# Register your models here.
@admin.register(History)
class HistoryAdmin(admin.ModelAdmin):
    list_display = ['key', 'agent', 'category']
    list_filter = ['category']
    list_per_page = 30

admin.site.register(Grade)

@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'title', 'hide', 'real_created_date', 'created_date']
    list_display_links = ['id', 'title']
    list_filter = ['author']
    list_per_page = 30

@admin.register(ThreadAnalytics)
class ThreadAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['id', 'date', 'thread']
    list_display_links = ['id', 'thread']
    list_filter = ['date']
    list_per_page = 30

@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'thread', 'created_date']
    list_filter = ['author']
    list_per_page = 30

@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'agree_email', 'agree_history', 'telegram_id', 'telegram_token', 'password_qna']
    actions = ['send_report']

    def send_report(self, request, queryset):
        pass
        # updated_count = queryset.update(hide=True)
        # self.message_user(request, str(updated_count) + '명에게 보고서 전송')
    
    send_report.short_description = '보고서 전송'

@admin.register(TempPosts)
class TempPostsAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'title', 'token', 'created_date',]
    list_display_links = ['id', 'title']
    list_filter = ['author']
    list_per_page = 30
    
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'title', 'hide', 'created_date', 'updated_date']
    list_display_links = ['id', 'title']
    list_filter = ['author']
    list_per_page = 30
    actions = ['update_md']

    def update_md(self, request, queryset):
        for data in queryset:
            data.text_html = parsedown(data.text_md)
            data.save()
        self.message_user(request, str(len(queryset)) + '개의 포스트 업데이트')

    update_md.short_description = '마크다운 업데이트'

@admin.register(PostLikes)
class PostLikesAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_date']
    list_filter = ['user']

@admin.register(PostAnalytics)
class PostAnalyticsAdmin(admin.ModelAdmin):
    list_display = ['id', 'date', 'posts']
    list_display_links = ['id', 'posts']
    list_filter = ['date']
    list_per_page = 30

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'post', 'text', 'created_date']
    list_filter = ['author']
    list_per_page = 30

@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'infomation', 'created_date']

@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'name', 'created_date']

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'grade']
    list_editable = ['grade']