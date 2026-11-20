from django.apps import AppConfig


class BoardConfig(AppConfig):
    name = 'board'

    def ready(self):
        from board import checks  # noqa: F401
        from board import work_log_signals  # noqa: F401
