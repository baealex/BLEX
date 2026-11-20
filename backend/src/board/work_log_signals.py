from functools import partial

from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from board.models.work_logs import WorkLogEntry


@receiver(post_delete, sender=WorkLogEntry)
def remove_entry_attachment(sender, instance: WorkLogEntry, using: str, **kwargs) -> None:
    if instance.attachment:
        transaction.on_commit(
            partial(instance.attachment.storage.delete, instance.attachment.name),
            using=using, robust=True,
        )
