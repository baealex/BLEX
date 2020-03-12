from django.contrib import admin

from.models import *

# Register your models here.
@admin.register(History)
class HistoryAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post']

admin.site.register(Grade)
admin.site.register(Thread)
admin.site.register(Story)
admin.site.register(TempPosts)
admin.site.register(Search)
admin.site.register(Analytics)
admin.site.register(SeriesPosts)

@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    list_display = ['user', 'agree_email', 'agree_history']

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'author', 'title', 'trendy', 'today', 'yesterday', 'total', 'hide', 'created_date', 'updated_date']
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
    list_display = ['id', 'user', 'infomation', 'created_date']

@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    list_display = ['id', 'owner', 'name', 'created_date']

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'grade']
    list_editable = ['grade']