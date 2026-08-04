import re

from django.utils.translation import gettext, gettext_noop


class BulkNotificationAuditMessageService:
    """Store stable audit copy and localize it only for presentation."""

    COMPLETED_TEMPLATE = gettext_noop(
        'Admin bulk notification delivery completed: requested %(requested)d; '
        'created %(created)d; duplicates %(duplicates)d; failures %(failures)d.'
    )
    FAILED_TEMPLATE = gettext_noop(
        'Admin bulk notification delivery failed: requested %(requested)d.'
    )
    COMPLETED_PATTERN = re.compile(
        r'^Admin bulk notification delivery completed: requested '
        r'(?P<requested>\d+); created (?P<created>\d+); duplicates '
        r'(?P<duplicates>\d+); failures (?P<failures>\d+)\.$'
    )
    FAILED_PATTERN = re.compile(
        r'^Admin bulk notification delivery failed: requested '
        r'(?P<requested>\d+)\.$'
    )

    @classmethod
    def completed(
        cls,
        *,
        requested: int,
        created: int,
        duplicates: int,
        failures: int,
    ) -> str:
        return cls.COMPLETED_TEMPLATE % {
            'requested': requested,
            'created': created,
            'duplicates': duplicates,
            'failures': failures,
        }

    @classmethod
    def failed(cls, *, requested: int) -> str:
        return cls.FAILED_TEMPLATE % {'requested': requested}

    @classmethod
    def localize(cls, message: str) -> str | None:
        if match := cls.COMPLETED_PATTERN.fullmatch(message):
            return gettext(cls.COMPLETED_TEMPLATE) % {
                key: int(value)
                for key, value in match.groupdict().items()
            }
        if match := cls.FAILED_PATTERN.fullmatch(message):
            return gettext(cls.FAILED_TEMPLATE) % {
                'requested': int(match.group('requested')),
            }
        return None
