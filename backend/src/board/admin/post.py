from django.contrib import admin
from django.db.models import Count

from board.models import (
    EditHistory, EditRequest, Post, PinnedPost, PostAnalytics, PostConfig,
    PostContent, PostLikes, PostNoThanks, PostThanks, TempPosts,
)

from .service import AdminDisplayService, AdminLinkService


admin.site.register(EditHistory)
admin.site.register(EditRequest)
admin.site.register(PinnedPost)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    search_fields = ['title', 'content__text_md', 'author__username', 'series__name']

    list_display = ['title', 'content_link', 'config_link', 'author_link', 'series_link', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author', 'content', 'config', 'series')

    def author_link(self, obj: Post):
        return AdminLinkService.create_user_link(obj.author)
    author_link.short_description = 'author'

    def content_link(self, obj):
        return AdminLinkService.create_post_content_link(obj.content)
    content_link.short_description = 'content'
    
    def config_link(self, obj):
        return AdminLinkService.create_post_config_link(obj.config)
    config_link.short_description = 'config'
    
    def series_link(self, obj):
        if obj.series:
            return AdminLinkService.create_series_link(obj.series)
        return None
    series_link.short_description = 'series'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['series', 'tags']
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
    fieldsets = (
        (None, {
            'fields': ('text_md', 'text_html'),
        }),
        ('Preview', {
            'fields': ('text_html_preview',),
        }),
    )
    readonly_fields = ['text_html_preview']

    def text_html_preview(self, obj):
        return AdminDisplayService.html(
            obj.text_html,
            use_folding=True,
            remove_lazy_load=True,
        )

    list_display = ['id']
    list_per_page = 100


@admin.register(TempPosts)
class TempPostsAdmin(admin.ModelAdmin):
    list_display = ['author_link', 'title', 'created_date', 'updated_date']
    list_display_links = ['title']
    list_per_page = 30

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('author')

    def author_link(self, obj):
        return AdminLinkService.create_user_link(obj.author)
    author_link.short_description = 'author'

    def get_form(self, request, obj=None, **kwargs):
        kwargs['exclude'] = ['author', 'token']
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
