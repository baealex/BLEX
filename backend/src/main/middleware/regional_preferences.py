from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.middleware.locale import LocaleMiddleware
from django.utils import timezone, translation
from django.utils.cache import patch_vary_headers

from board.services.regional_preferences_service import RegionalPreferencesService


class RegionalPreferencesMiddleware(LocaleMiddleware):
    async_capable = False

    def __call__(self, request: HttpRequest) -> HttpResponse:
        with translation.override(None), timezone.override(None):
            return super().__call__(request)

    def process_request(self, request: HttpRequest) -> None:
        super().process_request(request)
        if not request.user.is_authenticated:
            return

        config = getattr(request.user, 'config', None)
        if config is None:
            return

        language, time_zone = RegionalPreferencesService.normalize(config.language, config.time_zone)
        if config.language is not None:
            translation.activate(language or settings.LANGUAGE_CODE)
            request.LANGUAGE_CODE = translation.get_language()
        if time_zone:
            timezone.activate(time_zone)

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        response = super().process_response(request, response)
        patch_vary_headers(response, ('Cookie',))
        return response
