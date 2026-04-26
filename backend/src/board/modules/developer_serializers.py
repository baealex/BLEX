from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone


class DeveloperPostSerializer:
    @staticmethod
    def isoformat(value):
        if value is None:
            return None
        return value.isoformat()

    @staticmethod
    def tags(post):
        return sorted(post.tags.values_list('value', flat=True))

    @staticmethod
    def config(post):
        try:
            return post.config
        except ObjectDoesNotExist:
            return None

    @staticmethod
    def content(post):
        try:
            return post.content
        except ObjectDoesNotExist:
            return None

    @staticmethod
    def status(post):
        if post.published_date is None:
            return 'draft'
        if post.published_date > timezone.now():
            return 'scheduled'

        config = DeveloperPostSerializer.config(post)
        if config and config.hide:
            return 'hidden'

        return 'published'

    @staticmethod
    def series(post):
        if not post.series:
            return None

        return {
            'id': post.series.id,
            'name': post.series.name,
            'url': post.series.url,
        }

    @staticmethod
    def summary(post):
        config = DeveloperPostSerializer.config(post)
        content = DeveloperPostSerializer.content(post)

        return {
            'id': post.id,
            'title': post.title,
            'subtitle': post.subtitle,
            'url': post.url,
            'public_url': f'/@{post.author.username}/{post.url}',
            'status': DeveloperPostSerializer.status(post),
            'content_type': content.content_type if content else 'html',
            'tags': DeveloperPostSerializer.tags(post),
            'series': DeveloperPostSerializer.series(post),
            'is_hidden': config.hide if config else False,
            'is_advertise': config.advertise if config else False,
            'created_at': DeveloperPostSerializer.isoformat(post.created_date),
            'updated_at': DeveloperPostSerializer.isoformat(post.updated_date),
            'published_at': DeveloperPostSerializer.isoformat(post.published_date),
        }

    @staticmethod
    def detail(post):
        data = DeveloperPostSerializer.summary(post)
        content = DeveloperPostSerializer.content(post)
        raw_content = ''
        rendered_html = ''

        if content:
            rendered_html = content.text_html
            if content.content_type == 'markdown':
                raw_content = content.text_md
            else:
                raw_content = content.text_html

        data.update({
            'description': post.meta_description,
            'content': raw_content,
            'rendered_html': rendered_html,
            'read_time': post.read_time,
        })
        return data


class DeveloperTokenSerializer:
    @staticmethod
    def serialize(token):
        return {
            'id': token.id,
            'name': token.name,
            'token_prefix': token.token_prefix,
            'scopes': token.scopes,
            'expires_at': DeveloperPostSerializer.isoformat(token.expires_at),
            'revoked_at': DeveloperPostSerializer.isoformat(token.revoked_at),
            'last_used_at': DeveloperPostSerializer.isoformat(token.last_used_at),
            'created_at': DeveloperPostSerializer.isoformat(token.created_date),
        }
