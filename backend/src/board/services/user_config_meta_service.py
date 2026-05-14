from __future__ import annotations

from typing import TYPE_CHECKING

from board.constants.config_meta import CONFIG_MAP, CONFIG_TYPE, CONFIG_TYPES

if TYPE_CHECKING:
    from board.models import Config


class UserConfigMetaService:
    """Manage per-user notification configuration metadata."""

    @staticmethod
    def create_or_update_meta(
        config_model: 'Config',
        config: CONFIG_TYPE,
        value: object,
    ) -> bool | None:
        if config.value not in CONFIG_TYPES:
            return None

        meta = config_model.user.conf_meta.filter(name=config.value).first()
        if meta:
            if meta.value != value:
                meta.value = value
                meta.save()
            return True

        config_model.user.conf_meta.create(name=config.value, value=str(value))
        return True

    @staticmethod
    def get_meta(config_model: 'Config', config: CONFIG_TYPE) -> object | None:
        if config.value not in CONFIG_TYPES:
            return None

        meta = config_model.user.conf_meta.filter(name=config.value).first()
        if not meta:
            return None

        return CONFIG_MAP[meta.name]['type'](meta.value)
