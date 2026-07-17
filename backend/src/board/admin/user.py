"""
User & Profile Admin Configuration
"""
from typing import Any, Optional
from django import forms
from django.contrib import admin, messages
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpRequest
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, QuerySet
from django.urls import reverse
from django.utils.html import format_html, format_html_join

from board.models import (
    UserConfigMeta, UserLinkMeta, Config, UsernameChangeLog,
    EmailChange, Profile, TelegramSync, TwoFactorAuth
)
from board.constants.config_meta import CONFIG_TYPES
from board.services.email_change_service import (
    EmailChangeCancellationError,
    EmailChangeService,
)
from board.services.user_role_service import UserRoleService
from board.services.user_management_service import UserManagementService

from .action_confirmation import render_action_confirmation
from .mixins import (
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
)
from .service import AdminDisplayService, AdminLinkService
from .constants import COLOR_MUTED, COLOR_INFO, COLOR_BG, COLOR_TEXT
from .constants import LIST_PER_PAGE_DEFAULT


@admin.register(EmailChange)
class EmailChangeAdmin(
    ConfirmedActionDeleteAdminMixin,
    ReadOnlyRecordAdminMixin,
    admin.ModelAdmin,
):
    list_display = [
        'id',
        'user_link',
        'email',
        'token_status',
        'created_date',
    ]
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['user__username', 'email']
    fields = ['user_link', 'email', 'token_status', 'created_date']
    readonly_fields = [
        'user_link',
        'email',
        'token_status',
        'created_date',
    ]
    actions = ['cancel_email_changes']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').defer(
            'auth_token',
        )

    def user_link(self, obj: EmailChange):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'
    user_link.admin_order_field = 'user__username'

    def token_status(self, obj: EmailChange):
        return AdminDisplayService.boolean_badge(
            True,
            true_text='비공개',
        )
    token_status.short_description = '인증 토큰'

    @admin.action(
        description='선택한 이메일 변경 요청 취소',
        permissions=['delete'],
    )
    def cancel_email_changes(
        self,
        request: HttpRequest,
        queryset: QuerySet[EmailChange],
    ) -> Any:
        if request.POST.get('confirm') != 'yes':
            if not queryset.exists():
                self.message_user(
                    request,
                    '취소할 이메일 변경 요청이 없습니다.',
                    level=messages.WARNING,
                )
                return None
            return render_action_confirmation(
                request,
                self,
                queryset,
                action_name='cancel_email_changes',
                title='이메일 변경 요청 취소 확인',
                warning=(
                    '선택한 대기 요청과 인증 토큰만 삭제됩니다. 사용자의 '
                    '현재 이메일은 바뀌지 않습니다.'
                ),
                confirm_label='변경 요청 취소',
            )

        cancelled = 0
        failed = 0
        for email_change in queryset.select_related('user'):
            try:
                with transaction.atomic():
                    self.log_deletions(request, [email_change])
                    EmailChangeService.cancel_pending_change(email_change)
            except EmailChangeCancellationError:
                failed += 1
                continue
            cancelled += 1

        self.message_user(
            request,
            f'{cancelled}개의 이메일 변경 요청을 취소했습니다.',
            level=messages.SUCCESS,
        )
        if failed:
            self.message_user(
                request,
                f'{failed}개는 이미 처리되어 취소하지 못했습니다.',
                level=messages.WARNING,
            )
        return None


@admin.register(UsernameChangeLog)
class UsernameChangeLogAdmin(ReadOnlyRecordAdminMixin, admin.ModelAdmin):
    list_display = ['id', 'user_link', 'username', 'created_date']
    list_per_page = LIST_PER_PAGE_DEFAULT
    search_fields = ['user__username', 'username']
    fields = ['user_link', 'username', 'created_date']
    readonly_fields = fields

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def has_delete_permission(self, request, obj=None):
        return False

    def user_link(self, obj: UsernameChangeLog):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '현재 사용자'
    user_link.admin_order_field = 'user__username'


class UserLinkMetaInline(admin.TabularInline):
    model = UserLinkMeta
    extra = 1
    fields = ['order', 'name', 'value']
    ordering = ['order']


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    classes = ['collapse']
    fieldsets = (
        ('권한 설정', {
            'fields': ('role',),
        }),
        ('프로필 정보', {
            'fields': ('bio', 'homepage', 'avatar', 'cover'),
        }),
        ('통계 설정', {
            'fields': ('analytics_share_url',),
        }),
    )


# Django User Admin 커스터마이징
admin.site.unregister(User)

@admin.register(User)
class CustomUserAdmin(ConfirmedActionDeleteAdminMixin, BaseUserAdmin):
    inlines = [ProfileInline, UserLinkMetaInline]

    list_display = ['username', 'email', 'role_badge', 'post_count', 'is_staff', 'is_active', 'date_joined']
    list_filter = ['is_staff', 'is_active', 'profile__role', 'date_joined']
    search_fields = ['username', 'email', 'first_name', 'last_name']

    # autocomplete 지원
    ordering = ['username']

    actions = ['make_editor', 'make_reader', 'activate_users', 'deactivate_users']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('profile').annotate(
            post_count=Count('post', distinct=True)
        )

    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))
        if obj is None:
            return readonly_fields

        is_current_user = obj.pk == request.user.pk
        is_last_active_superuser = (
            obj.is_active
            and obj.is_superuser
            and not User.objects.filter(
                is_active=True,
                is_superuser=True,
            ).exclude(pk=obj.pk).exists()
        )
        if is_current_user or is_last_active_superuser:
            readonly_fields.extend([
                'is_active',
                'is_staff',
                'is_superuser',
            ])
        return list(dict.fromkeys(readonly_fields))

    def role_badge(self, obj):
        if hasattr(obj, 'profile'):
            return AdminDisplayService.role_badge(obj.profile.role)
        return AdminDisplayService.empty_placeholder()
    role_badge.short_description = '역할'

    def post_count(self, obj):
        count = obj.post_count if hasattr(obj, 'post_count') else obj.post_set.count()
        return AdminDisplayService.post_count_badge(count)
    post_count.short_description = '포스트 수'
    post_count.admin_order_field = 'post_count'

    def set_users_role(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
        *,
        role: str,
    ) -> int:
        with transaction.atomic():
            users = list(queryset.select_for_update().select_related('profile'))
            count = UserRoleService.set_users_role(queryset, role)
            role_label = '작가' if role == Profile.Role.EDITOR else '독자'
            for user in users:
                if hasattr(user, 'profile'):
                    self.log_change(
                        request,
                        user,
                        f'Admin에서 {role_label} 역할로 변경',
                    )
        return count

    @admin.action(
        description='선택한 사용자를 작가로 변경',
        permissions=['change'],
    )
    def make_editor(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
    ) -> None:
        count = self.set_users_role(
            request,
            queryset,
            role=Profile.Role.EDITOR,
        )
        self.message_user(request, f'{count}명의 사용자를 작가로 변경했습니다.')

    @admin.action(
        description='선택한 사용자를 독자로 변경',
        permissions=['change'],
    )
    def make_reader(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
    ) -> None:
        count = self.set_users_role(
            request,
            queryset,
            role=Profile.Role.READER,
        )
        self.message_user(request, f'{count}명의 사용자를 독자로 변경했습니다.')

    def set_users_active_status(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
        *,
        is_active: bool,
    ) -> Any:
        candidates = queryset.filter(is_active=not is_active)
        action_name = 'activate_users' if is_active else 'deactivate_users'
        status_label = '활성화' if is_active else '비활성화'
        if request.POST.get('confirm') != 'yes':
            if not candidates.exists():
                self.message_user(
                    request,
                    f'{status_label}할 사용자가 없습니다.',
                    level=messages.WARNING,
                )
                return None
            warning = (
                '선택한 계정의 로그인과 API 접근을 다시 허용합니다.'
                if is_active
                else (
                    '선택한 계정은 즉시 로그인과 API 접근이 차단됩니다. '
                    '현재 관리자와 마지막 활성 슈퍼유저는 건너뜁니다.'
                )
            )
            return render_action_confirmation(
                request,
                self,
                candidates,
                action_name=action_name,
                title=f'사용자 {status_label} 확인',
                warning=warning,
                confirm_label=f'사용자 {status_label}',
            )

        with transaction.atomic():
            result = UserManagementService.set_active_status(
                request.user,
                candidates.values_list('pk', flat=True),
                is_active=is_active,
            )
            for user in result.changed_users:
                self.log_change(
                    request,
                    user,
                    f'Admin에서 계정 {status_label}',
                )

        self.message_user(
            request,
            f'{len(result.changed_users)}명의 사용자를 {status_label}했습니다.',
            level=messages.SUCCESS,
        )
        if result.skipped_self_count:
            self.message_user(
                request,
                '현재 로그인한 관리자 계정은 비활성화하지 않았습니다.',
                level=messages.WARNING,
            )
        if result.skipped_last_superuser_count:
            self.message_user(
                request,
                '마지막 활성 슈퍼유저 계정은 비활성화하지 않았습니다.',
                level=messages.WARNING,
            )
        return None

    @admin.action(
        description='선택한 사용자 활성화',
        permissions=['change'],
    )
    def activate_users(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
    ) -> Any:
        return self.set_users_active_status(
            request,
            queryset,
            is_active=True,
        )

    @admin.action(
        description='선택한 사용자 비활성화',
        permissions=['change'],
    )
    def deactivate_users(
        self,
        request: HttpRequest,
        queryset: QuerySet[User],
    ) -> Any:
        return self.set_users_active_status(
            request,
            queryset,
            is_active=False,
        )


@admin.register(UserConfigMeta)
class UserConfigMetaAdmin(admin.ModelAdmin):
    class UserConfigMetaForm(forms.ModelForm):
        name = forms.ChoiceField(
            choices=[
                (config_type, config_type) for config_type in CONFIG_TYPES
            ],
        )
        value = forms.ChoiceField(
            choices=[
                ('true', '활성'),
                ('false', '비활성'),
            ],
        )

        class Meta:
            model = UserConfigMeta
            fields = '__all__'
    form = UserConfigMetaForm

    autocomplete_fields = ['user']

    def get_form(self, request, obj=None, **kwargs):
        if obj:
            kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)

    list_display = ['user_link', 'name', 'value', 'updated_date']
    list_display_links = ['name']
    list_filter = ['name', ('updated_date', admin.DateFieldListFilter)]
    search_fields = ['user__username', 'name', 'value']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'


@admin.register(UserLinkMeta)
class UserLinkMetaAdmin(admin.ModelAdmin):
    list_display = ['user_link', 'name', 'value', 'order']
    list_display_links = ['name']
    list_filter = ['name']
    search_fields = ['user__username', 'name', 'value']
    autocomplete_fields = ['user']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = 'user'

    def get_form(self, request, obj=None, **kwargs):
        if obj:
            kwargs['exclude'] = ['user']
        return super().get_form(request, obj, **kwargs)


@admin.register(Config)
class ConfigAdmin(admin.ModelAdmin):
    autocomplete_fields = ['user']

    fieldsets = (
        ('사용자 정보', {
            'fields': ('user',),
        }),
        ('설정 미리보기', {
            'fields': ('configs_preview',),
        }),
    )
    readonly_fields = ['configs_preview']

    def configs_preview(self, obj):
        configs = obj.user.conf_meta.all()
        if not configs:
            return format_html('<p style="color: {};">설정 없음</p>', COLOR_MUTED)

        config_items = format_html_join(
            '',
            '<li style="padding: 4px 0;"><a href="{}" style="text-decoration: none;">'
            '<span style="background: {}; color: {}; padding: 2px 8px; border-radius: 4px; font-size: 12px; opacity: 0.8;">{}</span> '
            '<span style="color: {};">{}</span></a></li>',
            (
                (
                    reverse(
                        'admin:board_userconfigmeta_change',
                        args=[config.id],
                    ),
                    COLOR_INFO,
                    COLOR_BG,
                    config.name,
                    COLOR_TEXT,
                    config.value,
                )
                for config in configs
            ),
        )
        return format_html(
            '<ul style="list-style: none; padding: 0;">{}</ul>',
            config_items,
        )

    list_display = ['user_link', 'telegram_status', 'two_factor_status']
    list_per_page = 30
    search_fields = ['user__username']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').only(
            'id',
            'user_id',
            'user__id',
            'user__username',
        ).annotate(
            telegram_linked=Exists(
                TelegramSync.objects.filter(
                    user_id=OuterRef('user_id'),
                ).exclude(tid=''),
            ),
            two_factor_enabled=Exists(
                TwoFactorAuth.objects.filter(
                    user_id=OuterRef('user_id'),
                ),
            ),
        )

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def telegram_status(self, obj):
        linked = getattr(obj, 'telegram_linked', None)
        if linked is None:
            linked = obj.has_telegram_id()
        return AdminDisplayService.boolean_badge(
            linked,
            true_text='연동됨',
            false_text='미연동'
        )
    telegram_status.short_description = '텔레그램'

    def two_factor_status(self, obj):
        enabled = getattr(obj, 'two_factor_enabled', None)
        if enabled is None:
            enabled = obj.has_two_factor_auth()
        return AdminDisplayService.boolean_badge(
            enabled,
            true_text='활성화',
            false_text='비활성화'
        )
    two_factor_status.short_description = '2FA'


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """프로필 관리 페이지"""
    autocomplete_fields = ['user']

    list_display = ['id', 'user_link', 'role_badge', 'avatar_preview', 'analytics_status', 'post_count']
    list_display_links = ['id']
    list_filter = ['role', ('user__date_joined', admin.DateFieldListFilter)]
    search_fields = ['user__username', 'user__email', 'bio', 'homepage']
    list_per_page = LIST_PER_PAGE_DEFAULT
    save_on_top = True

    actions = ['set_role_editor', 'set_role_reader']

    fieldsets = (
        ('사용자 정보', {
            'fields': ('user', 'user_info')
        }),
        ('권한 설정', {
            'fields': ('role',),
            'description': 'EDITOR: 글 작성 및 통계 / READER: 읽기만 가능'
        }),
        ('프로필 정보', {
            'fields': ('bio', 'homepage', 'avatar', 'avatar_preview', 'cover', 'cover_preview'),
        }),
        ('소개 페이지', {
            'fields': ('about_md', 'about_html'),
            'classes': ('collapse',),
        }),
        ('통계 설정', {
            'fields': ('analytics_share_url',),
            'classes': ('collapse',),
        }),
        ('통계', {
            'fields': ('total_posts',),
            'classes': ('collapse',),
        }),
    )

    readonly_fields = ['user_info', 'avatar_preview', 'cover_preview', 'total_posts']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user').annotate(
            post_count=Count('user__post', distinct=True)
        )

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def role_badge(self, obj):
        return AdminDisplayService.role_badge(obj.role)
    role_badge.short_description = '역할'

    def avatar_preview(self, obj):
        return AdminDisplayService.avatar_preview(obj.avatar)
    avatar_preview.short_description = '아바타'

    def cover_preview(self, obj):
        return AdminDisplayService.cover_preview(obj.cover)
    cover_preview.short_description = '커버 이미지 미리보기'

    def analytics_status(self, obj):
        return AdminDisplayService.boolean_badge(
            bool(obj.analytics_share_url),
            true_text='',
            false_text=''
        )
    analytics_status.short_description = '통계 URL'

    def post_count(self, obj):
        count = obj.post_count if hasattr(obj, 'post_count') else obj.user.post_set.count()
        return AdminDisplayService.post_count_badge(count)
    post_count.short_description = '포스트'
    post_count.admin_order_field = 'post_count'

    def user_info(self, obj):
        return AdminDisplayService.user_info_box(obj.user)
    user_info.short_description = '사용자 정보'

    def total_posts(self, obj):
        return obj.user.post_set.count()
    total_posts.short_description = '총 포스트 수'

    def set_profiles_role(
        self,
        request: HttpRequest,
        queryset: QuerySet[Profile],
        *,
        role: str,
    ) -> int:
        with transaction.atomic():
            profiles = list(queryset.select_for_update())
            count = UserRoleService.set_profiles_role(queryset, role)
            role_label = '작가' if role == Profile.Role.EDITOR else '독자'
            for profile in profiles:
                self.log_change(
                    request,
                    profile,
                    f'Admin에서 {role_label} 역할로 변경',
                )
        return count

    @admin.action(
        description='역할을 작가로 변경',
        permissions=['change'],
    )
    def set_role_editor(
        self,
        request: HttpRequest,
        queryset: QuerySet[Profile],
    ) -> None:
        count = self.set_profiles_role(
            request,
            queryset,
            role=Profile.Role.EDITOR,
        )
        self.message_user(request, f'{count}명의 프로필을 작가로 변경했습니다.')

    @admin.action(
        description='역할을 독자로 변경',
        permissions=['change'],
    )
    def set_role_reader(
        self,
        request: HttpRequest,
        queryset: QuerySet[Profile],
    ) -> None:
        count = self.set_profiles_role(
            request,
            queryset,
            role=Profile.Role.READER,
        )
        self.message_user(request, f'{count}명의 프로필을 독자로 변경했습니다.')
