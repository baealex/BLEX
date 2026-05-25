from django.utils import timezone

from board.models import Post, Series
from board.services.developer_token_service import DeveloperAuthError
from board.services.public_post_service import PublicPostService


class DeveloperPostAPI:
    @staticmethod
    def parse_bool(value, default=False):
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('1', 'true', 'yes', 'on')
        return bool(value)

    @staticmethod
    def tags_value(data):
        tags = data.get('tags', data.get('tag', ''))
        if isinstance(tags, list):
            return ','.join(str(tag).strip() for tag in tags if str(tag).strip())
        return tags or ''

    @staticmethod
    def content_value(data):
        for key in ('markdown', 'content_html', 'content', 'text_html', 'text_md'):
            if key in data:
                return data.get(key) or ''
        return ''

    @staticmethod
    def content_type(data):
        if 'markdown' in data:
            return 'markdown'
        content_type = data.get('content_type', 'html')
        if content_type not in ('html', 'markdown'):
            raise DeveloperAuthError(
                'post.invalid_content_type',
                'content_type은 html 또는 markdown이어야 합니다.',
                400,
            )
        return content_type

    @staticmethod
    def series_url(data, user):
        if data.get('series_url') is not None:
            return data.get('series_url')

        series_id = data.get('series_id')
        if series_id in (None, ''):
            return None

        try:
            series = Series.objects.get(id=series_id, owner=user)
        except (Series.DoesNotExist, ValueError, TypeError):
            raise DeveloperAuthError(
                'post.series_not_found',
                'series_id에 해당하는 시리즈를 찾을 수 없습니다.',
                404,
            )
        return series.url

    @staticmethod
    def post_queryset(user):
        return Post.objects.select_related(
            'author',
            'author__profile',
            'config',
            'content',
            'series',
        ).prefetch_related(
            'tags',
        ).filter(
            author=user,
        )

    @staticmethod
    def get_owned_post(user, post_id):
        try:
            return DeveloperPostAPI.post_queryset(user).get(id=post_id)
        except Post.DoesNotExist:
            raise DeveloperAuthError(
                'post.not_found',
                '글을 찾을 수 없습니다.',
                404,
            )

    @staticmethod
    def status_filter(queryset, status):
        now = timezone.now()

        if not status:
            return queryset
        if status == 'draft':
            return queryset.filter(published_date__isnull=True)
        if status == 'published':
            return PublicPostService.filter_public_posts(queryset)
        if status == 'scheduled':
            return queryset.filter(published_date__gt=now)
        if status == 'hidden':
            return queryset.filter(
                published_date__isnull=False,
                published_date__lte=now,
                config__hide=True,
            )

        raise DeveloperAuthError(
            'post.invalid_status',
            '지원하지 않는 status입니다.',
            400,
        )

    @staticmethod
    def update_config(post, data):
        if 'is_hidden' not in data and 'is_hide' not in data and 'is_advertise' not in data:
            return

        config = post.config
        if 'is_hidden' in data or 'is_hide' in data:
            config.hide = DeveloperPostAPI.parse_bool(
                data.get('is_hidden', data.get('is_hide')),
                config.hide,
            )
        if 'is_advertise' in data:
            config.advertise = DeveloperPostAPI.parse_bool(
                data.get('is_advertise'),
                config.advertise,
            )
        config.save()
