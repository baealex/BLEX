from __future__ import annotations

from typing import TYPE_CHECKING

from django.utils import timezone
from django.utils.text import slugify

from modules.randomness import randstr

if TYPE_CHECKING:
    from board.models import Series


class SeriesSaveService:
    """Encapsulates Series save-time slug and timestamp policy."""

    @staticmethod
    def create_unique_url(series: 'Series', url: str | None = None) -> None:
        next_url = url if url else slugify(series.name, allow_unicode=True)

        matching_series = series.__class__.objects.filter(url=next_url)
        while matching_series.exists():
            next_url = next_url + '-' + randstr(8)
            matching_series = series.__class__.objects.filter(url=next_url)

        series.url = next_url

    @staticmethod
    def prepare_for_save(series: 'Series') -> None:
        if not series.url:
            SeriesSaveService.create_unique_url(series)

        series.updated_date = timezone.now()
