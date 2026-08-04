"""
Post Admin Configuration
"""
from typing import Any

from django.contrib import admin, messages
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import (
    Count,
    IntegerField,
    OuterRef,
    QuerySet,
    Subquery,
    Value,
)
from django.db.models.functions import Coalesce
from django.http import HttpRequest
from django.utils import timezone
from django.utils.html import format_html
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext

from board.services.post_revision_service import PostRevisionService
from board.services.post_service import PostService, PostValidationError
from board.services.post_status_service import PostStatusService
from board.services.post_trash_service import PostTrashService
from board.models import (
    Comment,
    EditRequest,
    PinnedPost,
    Post,
    PostConfig,
    PostContent,
    PostLikes,
)

from .action_confirmation import render_action_confirmation
from .mixins import (
    ServiceOwnedRecordAdminMixin,
    is_admin_autocomplete_request,
    is_admin_changelist_request,
)
from .service import AdminDisplayService, AdminLinkService
from .constants import (
    LIST_PER_PAGE_DEFAULT,
    THUMBNAIL_SIZE, DATETIME_FORMAT_FULL
)


class PublishStatusFilter(admin.SimpleListFilter):
    """발행 상태 필터 (임시글/발행됨/예약됨)"""
    title = _('Publishing status')
    parameter_name = 'publish_status'

    def lookups(self, request, model_admin):
        return [
            ('draft', _('Draft')),
            ('published', _('Published')),
            ('scheduled', _('Scheduled')),
            ('trashed', _('Trash')),
        ]

    def queryset(self, request, queryset):
        if self.value() is None:
            return queryset.filter(deleted_date__isnull=True)
        if self.value() == 'draft':
            return PostStatusService.filter_drafts(queryset)
        elif self.value() == 'published':
            return PostStatusService.filter_published(queryset)
        elif self.value() == 'scheduled':
            return PostStatusService.filter_scheduled(queryset)
        elif self.value() == 'trashed':
            return queryset.filter(deleted_date__isnull=False)
        return queryset.filter(deleted_date__isnull=True)


@admin.register(EditRequest)
class EditRequestAdmin(ServiceOwnedRecordAdminMixin, admin.ModelAdmin):
    list_display = [
        'id',
        'post_link',
        'user_link',
        'title',
        'is_merged',
        'created_date',
    ]
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['post__title', 'user__username', 'title']
    list_filter = ['is_merged', ('created_date', admin.DateFieldListFilter)]
    fields = [
        'post_link',
        'user_link',
        'title',
        'content',
        'is_merged',
        'created_date',
        'updated_date',
    ]
    readonly_fields = fields

    def get_queryset(self, request):
        queryset = super().get_queryset(request).select_related(
            'post',
            'user',
        ).defer('user__password')
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('content')
        return queryset

    def post_link(self, obj: EditRequest):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = _('Post')
    post_link.admin_order_field = 'post__title'

    def user_link(self, obj: EditRequest):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('Requester')
    user_link.admin_order_field = 'user__username'


@admin.register(PinnedPost)
class PinnedPostAdmin(ServiceOwnedRecordAdminMixin, admin.ModelAdmin):
    list_display = ['id', 'post_link', 'user_link', 'order', 'created_date']
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['post__title', 'user__username']
    fields = ['post_link', 'user_link', 'order', 'created_date']
    readonly_fields = fields

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'post',
            'user',
        ).defer('user__password')

    def post_link(self, obj: PinnedPost):
        return AdminLinkService.create_post_link(obj.post)
    post_link.short_description = _('Post')
    post_link.admin_order_field = 'post__title'

    def user_link(self, obj: PinnedPost):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = _('User')
    user_link.admin_order_field = 'user__username'


class PostContentInline(admin.StackedInline):
    """Inline editor for post content HTML."""
    model = PostContent
    can_delete = False
    classes = ['collapse']
    fields = ['content_html']
    extra = 0
    max_num = 1


class PostConfigInline(admin.TabularInline):
    """Inline editor for post configuration (visibility, etc)."""
    model = PostConfig
    can_delete = False
    fields = ['hide', 'advertise', 'block_comment', 'cover_layout', 'cover_image_position', 'cover_image_ratio']
    extra = 0
    max_num = 1


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """
    Post 관리 페이지

    - select_related/prefetch_related로 쿼리 최적화
    - 상태 변경은 포스트 도메인 서비스와 감사 로그를 사용
    """

    search_fields = ['title', 'content__content_html', 'author__username', 'series__name', 'tags__value']
    ordering = ['-created_date']
    inlines = [PostContentInline, PostConfigInline]
    autocomplete_fields = ['author', 'series', 'tags']

    list_filter = [
        PublishStatusFilter,
        ('created_date', admin.DateFieldListFilter),
        ('updated_date', admin.DateFieldListFilter),
        'config__hide',
        'config__advertise',
        'config__block_comment',
        'config__cover_layout',
    ]

    list_display = [
        'thumbnail_preview',
        'title',
        'author_link',
        'series_link',
        'tags_preview',
        'likes_count',
        'comments_count',
        'publish_status',
        'status_badges',
        'published_date_display',
        'created_date',
    ]
    list_display_links = ['title']
    list_per_page = LIST_PER_PAGE_DEFAULT
    show_full_result_count = False
    save_on_top = True
    date_hierarchy = 'created_date'
    actions = [
        'make_hidden',
        'make_visible',
        'publish_drafts',
        'move_to_trash',
        'restore_from_trash',
        'permanently_delete_trashed',
    ]

    fieldsets = (
        (_('Basic information'), {
            'fields': ('author', 'title', 'url', 'series')
        }),
        (_('Publishing'), {
            'fields': (
                'published_date',
                'publish_status_display',
                'deleted_at',
            ),
        }),
        (_('Image'), {
            'fields': ('image', 'image_preview'),
            'classes': ('collapse',)
        }),
        (_('Tags & metadata'), {
            'fields': ('tags', 'meta_description', 'read_time')
        }),
        (_('Statistics'), {
            'fields': ('total_likes', 'total_comments', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    readonly_fields = [
        'image_preview',
        'publish_status_display',
        'deleted_at',
        'total_likes',
        'total_comments',
        'created_at',
        'updated_at',
    ]

    def get_queryset(self, request):
        queryset = Post.all_objects.all()
        ordering = self.get_ordering(request)
        if ordering:
            queryset = queryset.order_by(*ordering)

        if is_admin_autocomplete_request(request):
            return queryset.filter(deleted_date__isnull=True).only(
                'id',
                'title',
            )

        likes_count = PostLikes.objects.filter(
            post_id=OuterRef('pk'),
        ).order_by().values('post_id').annotate(
            total=Count('pk'),
        ).values('total')
        comments = Comment.objects.filter(
            post_id=OuterRef('pk'),
        ).order_by().values('post_id')
        comments_count = comments.annotate(
            total=Count('pk'),
        ).values('total')
        active_comments_count = comments.filter(
            author__isnull=False,
        ).annotate(
            total=Count('pk'),
        ).values('total')

        queryset = queryset.select_related(
            'author', 'config', 'series'
        ).defer('author__password').prefetch_related('tags').annotate(
            likes_count=Coalesce(
                Subquery(likes_count, output_field=IntegerField()),
                Value(0),
            ),
            comments_count=Coalesce(
                Subquery(comments_count, output_field=IntegerField()),
                Value(0),
            ),
            active_comments_count=Coalesce(
                Subquery(
                    active_comments_count,
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
        )
        if is_admin_changelist_request(request, self.model):
            return queryset.defer('series__text_md', 'series__text_html')
        return queryset

    def get_actions(self, request):
        actions = super().get_actions(request)
        actions.pop('delete_selected', None)
        return actions

    def has_change_permission(self, request, obj=None):
        if obj is not None and obj.deleted_date is not None:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj is not None:
            return False
        return super().has_delete_permission(request, obj)

    def save_model(self, request, obj, form, change):
        if change and obj.pk:
            persisted = Post.all_objects.select_for_update().get(pk=obj.pk)
            obj._admin_previous_snapshot = (
                PostRevisionService.capture_snapshot(persisted)
            )
            obj._admin_previous_updated_date = persisted.updated_date
            obj._admin_was_published = persisted.published_date is not None
            obj._admin_model_changed = form.has_changed()

        super().save_model(request, obj, form, change)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        post = form.instance
        if not change:
            PostContent.objects.get_or_create(post=post)
            PostConfig.objects.get_or_create(post=post)

        previous_snapshot = getattr(
            post,
            '_admin_previous_snapshot',
            None,
        )
        if previous_snapshot is None:
            return

        related_changed = any(
            formset.has_changed() for formset in formsets
        )
        should_update_date = (
            getattr(post, '_admin_model_changed', False)
            or related_changed
        )

        if should_update_date:
            post.updated_date = timezone.now()
            Post.all_objects.filter(pk=post.pk).update(
                updated_date=post.updated_date,
            )

        if getattr(post, '_admin_was_published', False):
            PostRevisionService.record_previous_snapshot_if_changed(
                post,
                previous_snapshot,
                source_updated_date=getattr(
                    post,
                    '_admin_previous_updated_date',
                    None,
                ),
                actor=request.user,
            )

        for attribute_name in (
            '_admin_previous_snapshot',
            '_admin_previous_updated_date',
            '_admin_was_published',
            '_admin_model_changed',
        ):
            if hasattr(post, attribute_name):
                delattr(post, attribute_name)

    def thumbnail_preview(self, obj: Post) -> str:
        width, height = THUMBNAIL_SIZE
        return AdminDisplayService.image_preview(
            obj.image.url if obj.image else None,
            width=width,
            height=height
        )
    thumbnail_preview.short_description = ''

    def author_link(self, obj: Post) -> str:
        return AdminLinkService.create_user_link(obj.author)
    author_link.short_description = _('Author')

    def series_link(self, obj: Post) -> str:
        return AdminLinkService.create_series_link(obj.series)
    series_link.short_description = _('Series')

    def tags_preview(self, obj: Post) -> str:
        return AdminDisplayService.tags_badges(obj.tags.all())
    tags_preview.short_description = _('Tags')

    def likes_count(self, obj: Post) -> str:
        count = obj.likes_count if hasattr(obj, 'likes_count') else obj.likes.count()
        return AdminDisplayService.like_count_badge(count)
    likes_count.short_description = _('Likes')
    likes_count.admin_order_field = 'likes_count'

    def comments_count(self, obj: Post) -> str:
        total_count = (
            obj.comments_count
            if hasattr(obj, 'comments_count')
            else obj.comments.count()
        )
        active_count = (
            obj.active_comments_count
            if hasattr(obj, 'active_comments_count')
            else obj.comments.filter(author__isnull=False).count()
        )
        deleted_count = total_count - active_count
        return format_html(
            '💬 {} <span style="color: var(--body-quiet-color, #666);">'
            '({} {})</span>',
            active_count,
            _('deleted'),
            deleted_count,
        )
    comments_count.short_description = _('Comments (active/deleted)')
    comments_count.admin_order_field = 'comments_count'

    def publish_status(self, obj: Post) -> str:
        return AdminDisplayService.publish_status_badge(obj)
    publish_status.short_description = _('Publishing')
    publish_status.admin_order_field = 'published_date'

    def published_date_display(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.published_date, DATETIME_FORMAT_FULL)
    published_date_display.short_description = _('Published at')
    published_date_display.admin_order_field = 'published_date'

    def publish_status_display(self, obj: Post) -> str:
        return AdminDisplayService.publish_status_badge(obj)
    publish_status_display.short_description = _('Publishing status')

    def status_badges(self, obj: Post) -> str:
        if hasattr(obj, 'config'):
            return AdminDisplayService.post_status_badges(obj.config)
        return AdminDisplayService.empty_placeholder()
    status_badges.short_description = _('Settings')

    def image_preview(self, obj: Post) -> str:
        if obj.image:
            return AdminDisplayService.image_preview(obj.image.url, width='400px', height='auto')
        return _('No image')
    image_preview.short_description = _('Image preview')

    def total_likes(self, obj: Post) -> int:
        if hasattr(obj, 'likes_count'):
            return obj.likes_count
        return obj.likes.count()
    total_likes.short_description = _('Total likes')

    def total_comments(self, obj: Post) -> int:
        if hasattr(obj, 'comments_count'):
            return obj.comments_count
        return obj.comments.count()
    total_comments.short_description = _('Total comments')

    def created_at(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.created_date, DATETIME_FORMAT_FULL)
    created_at.short_description = _('Created at')

    def updated_at(self, obj: Post) -> str:
        return AdminDisplayService.date_display(obj.updated_date, DATETIME_FORMAT_FULL)
    updated_at.short_description = _('Updated at')

    def deleted_at(self, obj: Post) -> str:
        return AdminDisplayService.date_display(
            obj.deleted_date,
            DATETIME_FORMAT_FULL,
        )
    deleted_at.short_description = _('Moved to trash at')

    @staticmethod
    def _active_posts(queryset: QuerySet[Post]) -> QuerySet[Post]:
        return queryset.filter(deleted_date__isnull=True)

    @admin.action(description=_('Hide selected posts'))
    def make_hidden(self, request: HttpRequest, queryset: QuerySet[Post]) -> None:
        """Route visibility changes through the post domain service."""
        count = 0
        failed = 0
        for post in self._active_posts(queryset).select_related('config'):
            try:
                with transaction.atomic():
                    updated_post = PostService.update_post(post, is_hide=True)
                    self.log_change(
                        request,
                        updated_post,
                        _('Hidden in Admin'),
                    )
            except (PostValidationError, ObjectDoesNotExist):
                failed += 1
                continue
            count += 1
        self.message_user(
            request,
            ngettext(
                '%(count)d post was hidden.',
                '%(count)d posts were hidden.',
                count,
            ) % {'count': count},
        )
        if failed:
            self.message_user(
                request,
                ngettext(
                    '%(count)d post could not be processed because required settings were missing.',
                    '%(count)d posts could not be processed because required settings were missing.',
                    failed,
                ) % {'count': failed},
                level=messages.WARNING,
            )

    @admin.action(description=_('Make selected posts public'))
    def make_visible(self, request: HttpRequest, queryset: QuerySet[Post]) -> Any:
        """Route visibility changes through the post domain service."""
        active_posts = self._active_posts(queryset)
        if request.POST.get('confirm') != 'yes':
            if not active_posts.exists():
                self.message_user(
                    request,
                    _('There are no active posts to make public.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                active_posts,
                action_name='make_visible',
                title=_('Confirm post publication'),
                warning=_(
                    'Published posts may become externally visible '
                    'immediately. Hidden status will also be removed from '
                    'drafts and scheduled posts.'
                ),
                confirm_label=_('Make public'),
                is_destructive=False,
            )

        count = 0
        failed = 0
        for post in active_posts.select_related('config'):
            try:
                with transaction.atomic():
                    updated_post = PostService.update_post(post, is_hide=False)
                    self.log_change(
                        request,
                        updated_post,
                        _('Made public in Admin'),
                    )
            except (PostValidationError, ObjectDoesNotExist):
                failed += 1
                continue
            count += 1
        self.message_user(
            request,
            ngettext(
                '%(count)d post was made public.',
                '%(count)d posts were made public.',
                count,
            ) % {'count': count},
        )
        if failed:
            self.message_user(
                request,
                ngettext(
                    '%(count)d post could not be processed because required settings were missing.',
                    '%(count)d posts could not be processed because required settings were missing.',
                    failed,
                ) % {'count': failed},
                level=messages.WARNING,
            )

    @admin.action(description=_('Publish selected drafts now'))
    def publish_drafts(self, request: HttpRequest, queryset: QuerySet[Post]) -> Any:
        """Publish drafts with validation, timestamps, and notifications."""
        drafts = PostStatusService.filter_drafts(queryset).select_related(
            'content',
            'config',
        )
        if request.POST.get('confirm') != 'yes':
            if not drafts.exists():
                self.message_user(
                    request,
                    _('There are no drafts to publish immediately.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                drafts,
                action_name='publish_drafts',
                title=_('Confirm immediate draft publication'),
                warning=_(
                    'Selected drafts will be published at the current time. '
                    'Depending on visibility settings, they may become '
                    'publicly visible and trigger subscriber notifications.'
                ),
                confirm_label=_('Publish now'),
                is_destructive=False,
            )

        count = 0
        failed = 0
        for post in drafts:
            try:
                with transaction.atomic():
                    published_post = PostService.publish_draft_now(post)
                    self.log_change(
                        request,
                        published_post,
                        _('Published immediately in Admin'),
                    )
            except (PostValidationError, ObjectDoesNotExist):
                failed += 1
                continue
            count += 1
        self.message_user(
            request,
            ngettext(
                '%(count)d draft was published.',
                '%(count)d drafts were published.',
                count,
            ) % {'count': count},
        )
        if failed:
            self.message_user(
                request,
                ngettext(
                    '%(count)d draft was skipped because it did not meet the publishing requirements.',
                    '%(count)d drafts were skipped because they did not meet the publishing requirements.',
                    failed,
                ) % {'count': failed},
                level=messages.WARNING,
            )

    @admin.action(description=_('Move selected posts to trash'))
    def move_to_trash(
        self,
        request: HttpRequest,
        queryset: QuerySet[Post],
    ) -> None:
        posts = list(self._active_posts(queryset))
        with transaction.atomic():
            for post in posts:
                trashed_post = PostTrashService.trash_post(post)
                self.log_change(
                    request,
                    trashed_post,
                    _('Moved to trash in Admin'),
                )

        count = len(posts)
        self.message_user(
            request,
            ngettext(
                '%(count)d post was moved to trash.',
                '%(count)d posts were moved to trash.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )

    @admin.action(description=_('Restore selected trashed posts'))
    def restore_from_trash(
        self,
        request: HttpRequest,
        queryset: QuerySet[Post],
    ) -> Any:
        trashed_queryset = queryset.filter(deleted_date__isnull=False)
        if request.POST.get('confirm') != 'yes':
            if not trashed_queryset.exists():
                self.message_user(
                    request,
                    _('There are no trashed posts to restore.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                trashed_queryset,
                action_name='restore_from_trash',
                title=_('Confirm restoration of trashed posts'),
                warning=_(
                    'Posts that were previously published and public may '
                    'become externally visible again immediately after '
                    'restoration.'
                ),
                confirm_label=_('Restore'),
                is_destructive=False,
            )

        posts = list(trashed_queryset)
        with transaction.atomic():
            for post in posts:
                restored_post = PostTrashService.restore_post(
                    post,
                    expected_deleted_date=post.deleted_date.isoformat(),
                )
                self.log_change(
                    request,
                    restored_post,
                    _('Restored from trash in Admin'),
                )

        count = len(posts)
        self.message_user(
            request,
            ngettext(
                '%(count)d post was restored.',
                '%(count)d posts were restored.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )

    @admin.action(
        description=_('Permanently delete selected trashed posts'),
        permissions=['delete'],
    )
    def permanently_delete_trashed(
        self,
        request: HttpRequest,
        queryset: QuerySet[Post],
    ) -> Any:
        trashed_queryset = queryset.filter(deleted_date__isnull=False)
        if request.POST.get('confirm') != 'yes':
            if not trashed_queryset.exists():
                self.message_user(
                    request,
                    _('There are no trashed posts to permanently delete.'),
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                trashed_queryset,
                action_name='permanently_delete_trashed',
                title=_('Confirm permanent deletion of trashed posts'),
                warning=_(
                    'Comments, revision history, and settings associated with '
                    'the posts will also be deleted. This action cannot be '
                    'undone.'
                ),
                confirm_label=_('Permanently delete'),
            )

        posts = list(trashed_queryset)
        if not posts:
            self.message_user(
                request,
                _('There are no trashed posts to permanently delete.'),
                level=messages.WARNING,
            )
            return None

        post_ids = [post.pk for post in posts]
        with transaction.atomic():
            self.log_deletions(
                request,
                Post.all_objects.filter(pk__in=post_ids),
            )
            for post in posts:
                PostTrashService.purge_post(
                    post,
                    expected_deleted_date=post.deleted_date.isoformat(),
                )

        count = len(posts)
        self.message_user(
            request,
            ngettext(
                '%(count)d trashed post was permanently deleted.',
                '%(count)d trashed posts were permanently deleted.',
                count,
            ) % {'count': count},
            level=messages.SUCCESS,
        )
        return None
