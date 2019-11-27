from django.contrib import admin
from.models import *

# Register your models here.
@admin.register(History)
class HistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'read_post']

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
    list_display = ['id', 'author', 'title', 'trendy', 'created_date', 'updated_date' ]
    list_display_links = ['id', 'title']
    list_filter = ['author']
    list_per_page = 30

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
    list_display = ['id', 'to_user', 'from_user', 'infomation', 'created_date']

@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'name', 'created_date']

admin.site.register(Profile)