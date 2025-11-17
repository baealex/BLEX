import datetime

from itertools import chain
from django.conf import settings
from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.constants.config_meta import CONFIG_TYPE
from board.models import (
    User, UsernameChangeLog, Post, PinnedPost, Profile, Series,
    Comment, Tag)
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.time import convert_to_localtime, time_since, time_stamp
from modules.markdown import parse_to_html


def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('about'):
            if not request.user == user:
                return StatusError(ErrorCode.AUTHENTICATION)

            about_md = put.get('about_md')
            about_html = parse_to_html(about_md)
            if hasattr(user, 'profile'):
                user.profile.about_md = about_md
                user.profile.about_html = about_html
                user.profile.save()
            else:
                profile = Profile(user=user)
                profile.about_md = about_md
                profile.about_html = about_html
                profile.save()

            return StatusDone()
    raise Http404

def check_redirect(request, username):
    if request.method == 'GET':
        if not username:
            return StatusError(ErrorCode.INVALID_PARAMETER)

        log = UsernameChangeLog.objects.filter(
            username=username
        ).annotate(
            user_username=F('user__username'),
        ).first()

        if log:
            return StatusDone({
                'old_username': log.username,
                'new_username': log.user_username,
                'created_date': convert_to_localtime(log.created_date).strftime('%Y년 %m월 %d일'),
            })
    raise Http404
