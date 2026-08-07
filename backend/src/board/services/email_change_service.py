from django.db import transaction
from django.utils.translation import gettext

from board.models import EmailChange


class EmailChangeCancellationError(Exception):
    pass


class EmailChangeService:
    """Manage pending email changes without mutating the user account."""

    @staticmethod
    @transaction.atomic
    def cancel_pending_change(email_change: EmailChange) -> int:
        try:
            pending_change = (
                EmailChange.objects.select_for_update()
                .only('id')
                .get(pk=email_change.pk)
            )
        except EmailChange.DoesNotExist as error:
            raise EmailChangeCancellationError(
                gettext('The email change request to cancel could not be found.'),
            ) from error

        pending_change_id = pending_change.pk
        pending_change.delete()
        return pending_change_id
