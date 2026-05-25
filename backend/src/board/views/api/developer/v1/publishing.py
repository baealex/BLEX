from django.db.models import Q

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

        return queryset.filter(
            Q(title__icontains=query)
            | Q(subtitle__icontains=query)
            | Q(url__icontains=query)
            | Q(meta_description__icontains=query)
            | Q(tags__value__icontains=query)
            | Q(content__content_html__icontains=query)
        )

    @staticmethod
    def filter_by_series_id(queryset, series_id):
        if series_id in (None, ''):
            return queryset

        try:
            series_id = int(series_id)
        except (TypeError, ValueError):
            raise DeveloperAuthError(
                'request.invalid_series_id',
                'series_id는 숫자여야 합니다.',
                400,
            )

        return queryset.filter(series_id=series_id)
