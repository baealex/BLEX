"""
User & Profile Admin Configuration
"""
from typing import Any, Optional
from django import forms
from django.contrib import admin
from django.contrib.auth.models import User
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpRequest
from django.db.models import Count, QuerySet
from django.urls import reverse
from django.utils.html import format_html

from board.models import (
    UserConfigMeta, UserLinkMeta, Config, UsernameChangeLog,
    EmailChange, Profile
)
from board.constants.config_meta import CONFIG_TYPES

from .service import AdminDisplayService, AdminLinkService
from .constants import COLOR_MUTED, COLOR_INFO, COLOR_BG, COLOR_TEXT
from .constants import LIST_PER_PAGE_DEFAULT


admin.site.register(EmailChange)
admin.site.register(UsernameChangeLog)


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
class CustomUserAdmin(BaseUserAdmin):
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

    def make_editor(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        user_ids = queryset.values_list('id', flat=True)
        count = Profile.objects.filter(user_id__in=user_ids).update(role=Profile.Role.EDITOR)
        self.message_user(request, f'{count}명의 사용자를 편집자로 변경했습니다.')
    make_editor.short_description = '선택한 사용자를 편집자로 변경'

    def make_reader(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        user_ids = queryset.values_list('id', flat=True)
        count = Profile.objects.filter(user_id__in=user_ids).update(role=Profile.Role.READER)
        self.message_user(request, f'{count}명의 사용자를 독자로 변경했습니다.')
    make_reader.short_description = '선택한 사용자를 독자로 변경'

    def activate_users(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count}명의 사용자를 활성화했습니다.')
    activate_users.short_description = '선택한 사용자 활성화'

    def deactivate_users(self, request: HttpRequest, queryset: QuerySet[User]) -> None:
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count}명의 사용자를 비활성화했습니다.')
    deactivate_users.short_description = '선택한 사용자 비활성화'


@admin.register(UserConfigMeta)
class UserConfigMetaAdmin(admin.ModelAdmin):
    class UserConfigMetaForm(forms.ModelForm):
        class Meta:
            model = UserConfigMeta
            fields = '__all__'
            widgets = {
                'name': forms.Select(
                    choices=[
                        (config_type, config_type) for config_type in CONFIG_TYPES
                    ],
                ),
            }
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

        config_items = "".join([
            f'<li style="padding: 4px 0;"><a href="{reverse("admin:board_userconfigmeta_change", args=[config.id])}" style="text-decoration: none;">'
            f'<span style="background: {COLOR_INFO}; color: {COLOR_BG}; padding: 2px 8px; border-radius: 4px; font-size: 12px; opacity: 0.8;">{config.name}</span> '
            f'<span style="color: {COLOR_TEXT};">{config.value}</span></a></li>'
            for config in configs
        ])

        return AdminDisplayService.html(f"""
                <ul style="list-style: none; padding: 0;">
                    {config_items}
                </ul>
            """
        )

    list_display = ['user_link', 'telegram_status', 'two_factor_status']
    list_per_page = 30
    search_fields = ['user__username']

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

    def user_link(self, obj):
        return AdminLinkService.create_user_link(obj.user)
    user_link.short_description = '사용자'

    def telegram_status(self, obj):
        return AdminDisplayService.boolean_badge(
            obj.has_telegram_id(),
            true_text='연동됨',
            false_text='미연동'
        )
    telegram_status.short_description = '텔레그램'

    def two_factor_status(self, obj):
        return AdminDisplayService.boolean_badge(
            obj.has_two_factor_auth(),
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

    actions = ['set_role_editor', 'set_role_reader', 'set_role_admin']

    fieldsets = (
        ('사용자 정보', {
            'fields': ('user', 'user_info')
        }),
        ('권한 설정', {
            'fields': ('role',),
            'description': 'ADMIN: 전체 관리 권한 / EDITOR: 글 작성 및 통계 / READER: 읽기만 가능'
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

    def set_role_editor(self, request: HttpRequest, queryset: QuerySet[Profile]) -> None:
        count = queryset.update(role=Profile.Role.EDITOR)
        self.message_user(request, f'{count}명의 프로필을 편집자로 변경했습니다.')
    set_role_editor.short_description = '역할을 편집자로 변경'

    def set_role_reader(self, request: HttpRequest, queryset: QuerySet[Profile]) -> None:
        count = queryset.update(role=Profile.Role.READER)
        self.message_user(request, f'{count}명의 프로필을 독자로 변경했습니다.')
    set_role_reader.short_description = '역할을 독자로 변경'

    def set_role_admin(self, request: HttpRequest, queryset: QuerySet[Profile]) -> None:
        count = queryset.update(role=Profile.Role.ADMIN)
        self.message_user(request, f'{count}명의 프로필을 관리자로 변경했습니다.')
    set_role_admin.short_description = '역할을 관리자로 변경'
