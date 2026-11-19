from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible
from django.utils.functional import cached_property


PRIVATE_WORK_LOG_DIRECTORY = '_work_logs'


@deconstructible
class WorkLogMediaStorage(FileSystemStorage):
    @cached_property
    def base_location(self) -> str:
        return str(Path(settings.MEDIA_ROOT) / PRIVATE_WORK_LOG_DIRECTORY)

    def url(self, name: str) -> str:
        raise ValueError('Work log attachments require an authorized download URL.')


work_log_media_storage = WorkLogMediaStorage(file_permissions_mode=0o600, directory_permissions_mode=0o700)


def work_log_attachment_name(instance, filename: str) -> str:
    key = uuid4().hex
    return f'{key[:2]}/{key}{Path(filename).suffix.lower()}'
