"""
Staff-facing user management service.
"""

from __future__ import annotations

from django.contrib.auth.models import User
from django.core.paginator import EmptyPage, Paginator
from django.db import transaction
from django.db.models import Count, Q

from board.models import Config, Profile
from board.services.user_role_service import UserRoleService


class UserManagementError(Exception):
    """Raised when a user management operation is rejected."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class UserManagementService:
    """Business logic for staff-only user role management."""

    MUTABLE_ROLES = {Profile.Role.READER, Profile.Role.EDITOR}
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    ROLE_FILTERS = {'all', 'reader', 'editor', 'admin'}
    ORDERING_FIELDS = {
        'username': 'username',
        '-username': '-username',
        'post_count': 'post_count',
        '-post_count': '-post_count',
        'date_joined': 'date_joined',
        '-date_joined': '-date_joined',
    }

    @staticmethod
    def list_users(
        query: str = '',
        role: str = 'all',
        ordering: str = 'username',
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
    ) -> dict:
        users = UserManagementService.get_user_queryset(
            query=query,
            role=role,
            ordering=ordering,
        )
        stats = UserManagementService.get_stats(users)
        page_size = UserManagementService.normalize_page_size(page_size)
        paginator = Paginator(users, page_size)
        page_number = UserManagementService.normalize_page(page, paginator.num_pages)

        try:
            user_page = paginator.page(page_number)
        except EmptyPage:
            page_number = paginator.num_pages or 1
            user_page = paginator.page(page_number)

        return {
            'users': [
                UserManagementService.serialize_user(user)
                for user in user_page.object_list
            ],
            'pagination': {
                'page': user_page.number,
                'page_size': page_size,
                'total': paginator.count,
                'total_pages': paginator.num_pages,
                'has_next': user_page.has_next(),
                'has_previous': user_page.has_previous(),
            },
            'stats': stats,
        }

    @staticmethod
    def get_user_queryset(query: str = '', role: str = 'all', ordering: str = 'username'):
        users = User.objects.select_related('profile').annotate(
            post_count=Count('post')
        )

        if query:
            users = users.filter(
                Q(username__icontains=query)
                | Q(email__icontains=query)
                | Q(first_name__icontains=query)
            )

        role = UserManagementService.normalize_role_filter(role)
        if role == 'reader':
            users = users.filter(profile__role=Profile.Role.READER)
        elif role == 'editor':
            users = users.filter(profile__role=Profile.Role.EDITOR)
        elif role == 'admin':
            users = users.filter(Q(is_staff=True) | Q(is_superuser=True))

        return users.order_by(
            UserManagementService.normalize_ordering(ordering),
            'username',
        )

    @staticmethod
    def normalize_role_filter(role: str) -> str:
        role = (role or 'all').lower()
        if role not in UserManagementService.ROLE_FILTERS:
            return 'all'

        return role

    @staticmethod
    def normalize_ordering(ordering: str) -> str:
        return UserManagementService.ORDERING_FIELDS.get(ordering, 'username')

    @staticmethod
    def get_stats(users) -> dict:
        return users.aggregate(
            total=Count('id', distinct=True),
            editors=Count(
                'id',
                filter=Q(profile__role=Profile.Role.EDITOR),
                distinct=True,
            ),
            readers=Count(
                'id',
                filter=Q(profile__role=Profile.Role.READER),
                distinct=True,
            ),
            admins=Count(
                'id',
                filter=Q(is_staff=True) | Q(is_superuser=True),
                distinct=True,
            ),
        )

    @staticmethod
    def normalize_page(page: int, total_pages: int) -> int:
        try:
            page = int(page)
        except (TypeError, ValueError):
            return 1

        if page < 1:
            return 1

        if total_pages and page > total_pages:
            return total_pages

        return page

    @staticmethod
    def normalize_page_size(page_size: int) -> int:
        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            return UserManagementService.DEFAULT_PAGE_SIZE

        if page_size < 1:
            return UserManagementService.DEFAULT_PAGE_SIZE

        return min(page_size, UserManagementService.MAX_PAGE_SIZE)

    @staticmethod
    def serialize_user(user: User) -> dict:
        try:
            role = user.profile.role
        except Profile.DoesNotExist:
            role = Profile.Role.READER

        can_change_role = user.is_active and not user.is_staff and not user.is_superuser

        return {
            'id': user.id,
            'username': user.username,
            'name': user.first_name,
            'email': user.email,
            'role': role,
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'can_change_role': can_change_role,
            'post_count': getattr(user, 'post_count', 0),
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'last_login': user.last_login.isoformat() if user.last_login else None,
        }

    @staticmethod
    @transaction.atomic
    def update_role(actor: User, target_user_id: int, role: str) -> dict:
        if role not in UserManagementService.MUTABLE_ROLES:
            raise UserManagementError('지원하지 않는 권한입니다.')

        target = User.objects.select_for_update().select_related('profile').get(pk=target_user_id)

        if actor.pk == target.pk:
            raise UserManagementError('자기 자신의 권한은 변경할 수 없습니다.')

        if target.is_staff or target.is_superuser:
            raise UserManagementError('관리자 계정의 권한은 이 화면에서 변경할 수 없습니다.')

        try:
            profile = target.profile
        except Profile.DoesNotExist:
            profile = Profile.objects.create(user=target)

        UserRoleService.set_profile_role(profile, role)
        Config.objects.get_or_create(user=target)

        target.post_count = target.post_set.count()
        return UserManagementService.serialize_user(target)
