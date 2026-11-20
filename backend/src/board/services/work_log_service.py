from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Count, QuerySet
from django.utils.translation import gettext as _

from board.models.work_logs import WorkLog, WorkLogEntry, WorkLogShare


class WorkLogService:
    page_size = 20
    media_extensions = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
    }

    @staticmethod
    def list_logs(owner: User) -> QuerySet[WorkLog]:
        return WorkLog.objects.filter(owner=owner).order_by('-created_at', '-pk')

    @staticmethod
    def attach_entry_counts(logs: list[WorkLog]) -> None:
        counts = dict(
            WorkLogEntry.objects.filter(log__in=logs)
            .values('log_id')
            .annotate(total=Count('pk'))
            .values_list('log_id', 'total'),
        )
        for log in logs:
            log.entry_count = counts.get(log.pk, 0)

    @staticmethod
    def list_entries(log: WorkLog) -> QuerySet[WorkLogEntry]:
        return log.entries.order_by('-created_at', '-pk')

    @staticmethod
    def add_entry(
        log: WorkLog, title: str, text: str, attachment: tuple[str, UploadedFile | None],
    ) -> WorkLogEntry:
        media_type, uploaded_file = attachment
        entry = WorkLogEntry(log=log, title=title, text=text, media_type=media_type)
        if uploaded_file:
            name = f'attachment{WorkLogService.media_extensions[media_type]}'
            entry.attachment.save(name, uploaded_file, save=False)
        try:
            entry.save()
        except Exception:
            if entry.attachment:
                entry.attachment.delete(save=False)
            raise
        return entry

    @staticmethod
    def selected_entries(log: WorkLog, ids: set[int]) -> QuerySet[WorkLogEntry]:
        return log.entries.filter(pk__in=ids).order_by('created_at', 'pk')

    @staticmethod
    @transaction.atomic
    def delete_entry(entry: WorkLogEntry) -> None:
        log_id = entry.log_id
        entry.delete()
        WorkLogShare.objects.filter(log_id=log_id, entries__isnull=True).delete()

    @staticmethod
    @transaction.atomic
    def create_share(log: WorkLog, headline: str, entry_ids: set[int]) -> WorkLogShare:
        if WorkLogService.selected_entries(log, entry_ids).count() != len(entry_ids):
            raise ValidationError(_('Choose entries from this work log.'))
        share = log.shares.create(headline=headline)
        share.entries.set(entry_ids)
        return share

    @staticmethod
    def shared_entries(share: WorkLogShare) -> QuerySet[WorkLogEntry]:
        return share.entries.filter(log=share.log).order_by('created_at', 'pk')
