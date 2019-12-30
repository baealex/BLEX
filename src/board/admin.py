from django.contrib import admin
from.models import *

# Register your models here.
@admin.register(History)
class HistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post']

@admin.register(Font)
class FontAdmin(admin.ModelAdmin):
    list_display = ['id', 'name']
    list_editable = ['name']

@admin.register(Theme)
class ThemeAdmin(admin.ModelAdmin):
    list_display = ['id', 'color']
    list_editable = ['color']

@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'agree_email', 'agree_history']

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'title', 'trendy', 'hide', 'created_date', 'updated_date']
    list_display_links = ['id', 'title']
    list_filter = ['author']
    actions = ['make_open', 'make_hide']
    list_per_page = 30

    def make_open(self, request, queryset):
        updated_count = queryset.update(hide=False)
        self.message_user(request, str(updated_count)+'건의 글을 공개로 변경')
    
    def make_hide(self, request, queryset):
        updated_count = queryset.update(hide=True)
        self.message_user(request, str(updated_count)+'건의 글을 공개로 변경')
    
    make_open.short_description = '지정 포스트를 공개'
    make_hide.short_description = '지정 포스트를 숨김'

@admin.register(PostLikes)
class PostLikesAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_date']
    list_filter = ['user']

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'post', 'text', 'created_date']
    list_filter = ['author']
    list_per_page = 30

@admin.register(Notify)
class NotifyAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'infomation', 'created_date']

@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'name', 'created_date']

admin.site.register(Profile)