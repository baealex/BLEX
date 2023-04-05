import datetime
import pytz

from django.utils import timezone
from django.utils.timesince import timesince


def time_stamp(date, kind=''):
    if kind == 'grass':
        date = date + datetime.timedelta(hours=9)
        date = date.replace(hour=12, minute=0, second=0)

    timestamp = str(date.timestamp()).replace('.', '')
    timestamp = timestamp + '0' * (16 - len(timestamp))
    return timestamp


def time_since(date):
    one_year_ago = timezone.now() - datetime.timedelta(days=365)

    if date < one_year_ago:
        return date.strftime('%Y. %m. %d.')

    date_since = timesince(date)
    if ',' in date_since:
        date_since = date_since.split(',')[0]
    return f'{date_since} 전'


def convert_to_localtime(utctime):
    utc = utctime.replace(tzinfo=pytz.UTC)
    localtz = utc.astimezone(timezone.get_current_timezone())
    return localtz
