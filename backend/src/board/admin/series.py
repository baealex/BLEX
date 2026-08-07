from typing import Any

from django.contrib import admin, messages
from django.db import transaction
from django.db.models import Count, OuterRef, Q, QuerySet, Subquery
from django.http import HttpRequest
from django.urls import reverse
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.models import Series, Post
from board.services.public_post_service import PublicPostService

from .action_confirmation import render_action_confirmation
from .mixins import (
    is_admin_autocomplete_request,
    is_admin_changelist_request,
)
from .service import AdminDisplayService, AdminLinkService
from .constants import (
    COLOR_DANGER, COLOR_SUCCESS, COLOR_PRIMARY, COLOR_MUTED,
    COLOR_INFO, COLOR_DARKENED_BG, COLOR_TEXT, COLOR_BG, COLOR_BORDER,
    THUMBNAIL_SIZE,
)


class SeriesPostInline(admin.TabularInline):
    model = Post
    fields = ['title', 'created_date', 'config_hide', 'view_link']
    readonly_fields = ['title', 'created_date', 'config_hide', 'view_link']
    can_delete = False
    extra = 0
    max_num = 0
    show_change_link = True

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('config')

    def config_hide(self, obj):
        if hasattr(obj, 'config') and obj.config.hide:
            return format_html(
                '<span style="color: {};">{}</span>',
                COLOR_DANGER,
                _('Hidden'),
            )
        return format_html(
            '<span style="color: {};">{}</span>',
            COLOR_SUCCESS,
            _('Public'),
        )
    config_hide.short_description = _('Status')

    def view_link(self, obj):
        url = reverse('admin:board_post_change', args=[obj.id])
        return format_html(
            '<a href="{}" style="color: {};">{}</a>',
            url,
            COLOR_PRIMARY,
            _('Edit'),
        )
    view_link.short_description = _('Edit')


@admin.register(Series)
class SeriesAdmin(admin.ModelAdmin):
    inlines = [SeriesPostInline]
    autocomplete_fields = ['owner']
    search_fields = ['name', 'owner__username', 'text_md']
    show_full_result_count = False

    # autocomplete 지원
    ordering = ['name']

    list_filter = [
        'hide',
        'layout',
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
    ]

    actions = ['make_hidden', 'make_visible', 'set_layout_list', 'set_layout_card']

    def get_queryset(self, request):
        if is_admin_autocomplete_request(request):
            return super().get_queryset(request).only('id', 'name')

        public_posts = PublicPostService.filter_public_posts(
            Post.objects,
        ).filter(series=OuterRef('pk')).order_by('pk')
        queryset = super().get_queryset(request).select_related(
            'owner'
        ).defer('owner__password').annotate(
            count_posts=Count(
                'posts',
                filter=Q(posts__deleted_date__isnull=True),
                distinct=True,
            ),
            public_post_count=Count(
                'posts',
                filter=PublicPostService.build_public_filter('posts'),
                distinct=True,
            ),
            trashed_post_count=Count(
                'posts',
                filter=Q(posts__deleted_date__isnull=False),
                distinct=True,
            ),
            admin_thumbnail_name=Subquery(
                public_posts.values('image')[:1],
            ),
        )
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('text_md', 'text_html')
        return queryset

    fieldsets = (
        (_('Basic information'), {
            'fields': ('owner', 'name', 'url'),
        }),
        (_('Settings'), {
            'fields': ('hide', 'layout', 'order'),
        }),
        (_('Content'), {
            'fields': ('text_md', 'text_html'),
            'classes': ('collapse',),
        }),
        (_('Posts'), {
            'fields': ('posts_summary',),
        }),
        (_('Metadata'), {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )
    readonly_fields = ['url', 'posts_summary', 'created_at', 'updated_at']

    list_display = [
        'name',
        'owner_link',
        'count_posts',
        'public_posts',
        'trashed_posts',
        'layout_badge',
        'visibility_badge',
        'thumbnail_preview',
        'created_date'
    ]
    list_display_links = ['name']
    list_per_page = 30
    save_on_top = True

    def owner_link(self, obj):
        return AdminLinkService.create_user_link(obj.owner)
    owner_link.short_description = _('Author')

    def count_posts(self, obj):
        count = obj.count_posts if hasattr(obj, 'count_posts') else obj.posts.count()
        return format_html('📚 {}', count)
    count_posts.short_description = _('Active posts')
    count_posts.admin_order_field = 'count_posts'

    def public_posts(self, obj):
        count = getattr(obj, 'public_post_count', None)
        if count is None:
            count = PublicPostService.filter_public_posts(
                Post.all_objects.filter(series=obj),
            ).count()
        return count
    public_posts.short_description = _('Public posts')
    public_posts.admin_order_field = 'public_post_count'

    def trashed_posts(self, obj):
        count = getattr(obj, 'trashed_post_count', None)
        if count is None:
            count = Post.all_objects.filter(
                series=obj,
                deleted_date__isnull=False,
            ).count()
        return count
    trashed_posts.short_description = _('Trash')
    trashed_posts.admin_order_field = 'trashed_post_count'

    def layout_badge(self, obj):
        if obj.layout == 'card':
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">{}</span>',
                COLOR_INFO, COLOR_BG, _('Card')
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">{}</span>',
            COLOR_DARKENED_BG, COLOR_TEXT, _('List')
        )
    layout_badge.short_description = _('Layout')

    def visibility_badge(self, obj):
        if obj.hide:
            return format_html(
                '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">{}</span>',
                COLOR_DANGER, COLOR_BG, _('Hidden')
            )
        return format_html(
            '<span style="background: {}; color: {}; padding: 3px 8px; border-radius: 4px; font-size: 11px; opacity: 0.8;">{}</span>',
            COLOR_SUCCESS, COLOR_BG, _('Public')
        )
    visibility_badge.short_description = _('Status')

    def thumbnail_preview(self, obj):
        thumbnail_name = getattr(obj, 'admin_thumbnail_name', None)
        if hasattr(obj, 'admin_thumbnail_name'):
            thumbnail_url = (
                Post._meta.get_field('image').storage.url(thumbnail_name)
                if thumbnail_name
                else ''
            )
        else:
            thumbnail_url = obj.thumbnail()
        if thumbnail_url:
            width, height = THUMBNAIL_SIZE
            return AdminDisplayService.image_preview(
                thumbnail_url,
                width=width,
                height=height,
            )
        return format_html(
            '<div style="width: 60px; height: 60px; background: {}; border-radius: 6px;"></div>',
            COLOR_DARKENED_BG
        )
    thumbnail_preview.short_description = ''

    def posts_summary(self, obj):
        if hasattr(obj, 'count_posts'):
            active_posts = obj.count_posts
            public_posts = obj.public_post_count
            trashed_posts = obj.trashed_post_count
        else:
            active_posts = Post.all_objects.filter(
                series=obj,
                deleted_date__isnull=True,
            ).count()
            public_posts = PublicPostService.filter_public_posts(
                Post.all_objects.filter(series=obj),
            ).count()
            trashed_posts = Post.all_objects.filter(
                series=obj,
                deleted_date__isnull=False,
            ).count()

        if active_posts == 0 and trashed_posts == 0:
            return format_html(
                '<p style="color: {};">{}</p>',
                COLOR_MUTED,
                _('No posts'),
            )

        return format_html(
            '<div style="background: {}; padding: 12px; border-radius: 6px; border: 1px solid {};">'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> {}</p>'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> <span style="color: {};">{}</span></p>'
            '<p style="margin: 4px 0; color: {};"><strong>{}:</strong> <span style="color: {};">{}</span></p>'
            '</div>',
            COLOR_DARKENED_BG, COLOR_BORDER,
            COLOR_TEXT, _('Active posts'), active_posts,
            COLOR_TEXT, _('Publicly visible'), COLOR_SUCCESS, public_posts,
            COLOR_TEXT, _('Trash'), COLOR_DANGER, trashed_posts,
        )
    posts_summary.short_description = _('Post summary')

    def created_at(self, obj):
        return obj.created_date.strftime('%Y-%m-%d %H:%M:%S')
    created_at.short_description = _('Created at')

    def updated_at(self, obj):
        return obj.updated_date.strftime('%Y-%m-%d %H:%M:%S')
    updated_at.short_description = _('Updated at')

    def _update_series_fields(
        self,
        request: HttpRequest,
        queryset: QuerySet[Series],
        *,
        change_message: str,
        **updates: object,
    ) -> int:
        count = 0
        with transaction.atomic():
            selected_series = Series.objects.select_for_update().filter(
                pk__in=queryset.values('pk'),
            )
            for series in selected_series:
                changed_fields = []
                for field_name, value in updates.items():
                    if getattr(series, field_name) == value:
                        continue
                    setattr(series, field_name, value)
                    changed_fields.append(field_name)

                if not changed_fields:
                    continue

                series.save(
                    update_fields=[*changed_fields, 'updated_date'],
                )
                self.log_change(request, series, change_message)
                count += 1
        return count

    @admin.action(description=_('Hide selected series'))
    def make_hidden(
        self,
        request: HttpRequest,
        queryset: QuerySet[Series],
    ) -> None:
        count = self._update_series_fields(
            request,
            queryset.filter(hide=False),
            hide=True,
            change_message=_('Hidden in Admin'),
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d series was hidden.',
                '%(count)d series were hidden.',
                count,
            ) % {'count': count},
        )

    @admin.action(description=_('Make selected series public'))
    def make_visible(
        self,
        request: HttpRequest,
        queryset: QuerySet[Series],
    ) -> Any:
        hidden_series = queryset.filter(hide=True)
        if request.POST.get('confirm') != 'yes':
            if not hidden_series.exists():
                self.message_user(
                    request,
                    _('There are no hidden series to make public.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                hidden_series,
                action_name='make_visible',
                title=_('Confirm series publication'),
                warning=_(
                    'Series containing public posts may become externally '
                    'visible immediately.'
                ),
                confirm_label=_('Make public'),
                is_destructive=False,
            )

        count = self._update_series_fields(
            request,
            hidden_series,
            hide=False,
            change_message=_('Made public in Admin'),
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d series was made public.',
                '%(count)d series were made public.',
                count,
            ) % {'count': count},
        )

    @admin.action(description=_('Change layout to list'))
    def set_layout_list(
        self,
        request: HttpRequest,
        queryset: QuerySet[Series],
    ) -> None:
        count = self._update_series_fields(
            request,
            queryset.exclude(layout='list'),
            layout='list',
            change_message=_('Changed to list layout in Admin'),
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d series was changed to the list layout.',
                '%(count)d series were changed to the list layout.',
                count,
            ) % {'count': count},
        )

    @admin.action(description=_('Change layout to cards'))
    def set_layout_card(
        self,
        request: HttpRequest,
        queryset: QuerySet[Series],
    ) -> None:
        count = self._update_series_fields(
            request,
            queryset.exclude(layout='card'),
            layout='card',
            change_message=_('Changed to card layout in Admin'),
        )
        self.message_user(
            request,
            ngettext(
                '%(count)d series was changed to the card layout.',
                '%(count)d series were changed to the card layout.',
                count,
            ) % {'count': count},
        )
