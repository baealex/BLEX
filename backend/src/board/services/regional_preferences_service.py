from functools import cache
from zoneinfo import available_timezones

from django.conf import settings
from django.contrib.auth.models import User
from django.utils.translation import gettext

from board.models import Config


class RegionalPreferenceError(ValueError):
    def __init__(self, field: str, message: str) -> None:
        super().__init__(message)
        self.message_key = f'settings.regional_preferences.invalid_{field}'


class RegionalPreferencesService:
    @staticmethod
    def supported_language(value: object) -> bool:
        return isinstance(value, str) and any(code == value for code, _ in settings.LANGUAGES)

    @staticmethod
    @cache
    def available_time_zones() -> tuple[str, ...]:
        return tuple(sorted(available_timezones() - {'Factory', 'localtime'}))

    @classmethod
    def supported_time_zone(cls, value: object) -> bool:
        return isinstance(value, str) and len(value) <= 64 and value in cls.available_time_zones()

    @classmethod
    def normalize(cls, language: str | None, time_zone: str | None) -> tuple[str, str]:
        return (
            language if language and cls.supported_language(language) else '',
            time_zone if time_zone and cls.supported_time_zone(time_zone) else '',
        )

    @classmethod
    def serialize(cls, config: Config | None) -> dict[str, object]:
        language, time_zone = cls.normalize(
            config.language if config else '',
            config.time_zone if config else '',
        )
        return {
            'language': None if config is None or config.language is None else language,
            'time_zone': time_zone,
            'default_language': settings.LANGUAGE_CODE,
            'default_time_zone': settings.TIME_ZONE,
            'languages': [{'code': code, 'label': str(label)} for code, label in settings.LANGUAGES],
            'time_zones': cls.available_time_zones(),
        }

    @classmethod
    def initialize(cls, config: Config, language: str | None, time_zone: str | None) -> None:
        config.language, config.time_zone = cls.normalize(language, time_zone)
        if config.language or config.time_zone:
            config.save(update_fields=['language', 'time_zone'])

    @classmethod
    def save(cls, user: User, language: object, time_zone: object) -> None:
        if language not in (None, '') and not cls.supported_language(language):
            raise RegionalPreferenceError('language', gettext('Choose a supported language.'))
        if time_zone != '' and not cls.supported_time_zone(time_zone):
            raise RegionalPreferenceError('time_zone', gettext('Choose a valid time zone.'))
        Config.objects.update_or_create(
            user=user, defaults={'language': language, 'time_zone': time_zone},
        )
