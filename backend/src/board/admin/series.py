from django.contrib import admin
from django.db.models import Count
from django.urls import reverse

from board.models import Series

from .service import AdminDisplayService, AdminLinkService


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'owner'
        ).annotate(
            count_posts=Count('posts', distinct=True)
        )

    fieldsets = (
        (None, {
            'fields': ('owner', 'name',),
        }),
        ('Preview', {
            'fields': ('posts_preview',),
        }),
    )
    readonly_fields = ['posts_preview']

    def posts_preview(self, obj):
        posts = obj.posts.all()
        return AdminDisplayService.html(f"""
                <ul>
                    {"".join([f'<li><a href="{reverse("admin:board_post_change", args=[post.id])}">{post.title}</a></li>' for post in posts])}
                </ul>
            """,
            use_folding=True
        )

    list_display = ['name', 'count_posts', 'owner_link', 'created_date']
    list_display_links = ['name']
    list_per_page = 30

    def owner_link(self, obj):
        return AdminLinkService.create_user_link(obj.owner)
    owner_link.short_description = 'owner'

    def count_posts(self, obj):
        return obj.count_posts
    count_posts.admin_order_field = 'count_posts'
