from django.db.models import Exists, OuterRef, Q
from django.utils.translation import gettext

from board.models import Post
from board.services.developer_token_service import DeveloperAuthError


class DeveloperPublishingAPI:
    @staticmethod
    def tags_param(request):
        tags = []
        for value in request.GET.getlist('tag'):
            tags.extend(value.split(','))
        return [tag.strip() for tag in tags if tag.strip()]

    @staticmethod
    def filter_by_search_query(queryset, query):
        query = (query or '').strip()
        if not query:
            return queryset

        tag_match = Post.tags.through.objects.filter(
            post_id=OuterRef('pk'),
            tag__value__icontains=query,
        )
        return queryset.annotate(
            developer_tag_match=Exists(tag_match),
        ).filter(
            Q(title__icontains=query)
            | Q(subtitle__icontains=query)
            | Q(url__icontains=query)
            | Q(meta_description__icontains=query)
            | Q(developer_tag_match=True)
            | Q(content__content_html__icontains=query)
        )

    @staticmethod
    def filter_by_tags(queryset, tags):
        if not tags:
            return queryset

        tag_match = Post.tags.through.objects.filter(
            post_id=OuterRef('pk'),
            tag__value__in=tags,
        )
        return queryset.filter(Exists(tag_match))

    @staticmethod
    def filter_by_series_id(queryset, series_id):
        if series_id in (None, ''):
            return queryset

        try:
            series_id = int(series_id)
        except (TypeError, ValueError):
            raise DeveloperAuthError(
                'request.invalid_series_id',
                gettext('series_id must be a number.'),
                400,
            )

        return queryset.filter(series_id=series_id)
