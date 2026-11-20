import uuid

from django.conf import settings
from django.db import models

from board.work_log_storage import work_log_attachment_name, work_log_media_storage


class WorkLog(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)


class WorkLogEntry(models.Model):
    log = models.ForeignKey(WorkLog, related_name='entries', on_delete=models.CASCADE)
    title = models.CharField(max_length=100, blank=True)
    text = models.TextField(blank=True)
    media_type = models.CharField(max_length=24, blank=True)
    attachment = models.FileField(
        storage=work_log_media_storage, upload_to=work_log_attachment_name, blank=True, editable=False,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['log', '-created_at', '-id'], name='worklog_entry_timeline')]

    @property
    def has_video(self) -> bool:
        return self.media_type.startswith('video/')


class WorkLogShare(models.Model):
    log = models.ForeignKey(WorkLog, related_name='shares', on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    headline = models.CharField(max_length=120)
    entries = models.ManyToManyField(WorkLogEntry, related_name='shares')
    created_at = models.DateTimeField(auto_now_add=True)
