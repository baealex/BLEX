import json

from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.models import User
from board.services import PinnedPostService
from board.services.pinned_post_service import PinnedPostError
from board.modules.response import StatusDone, StatusError, ErrorCode


def pinned_posts(request, username):
    """
    Manage pinned posts for a user.

    GET: Get all pinned posts for the user
    POST: Add a new pinned post
    DELETE: Remove a pinned post
    """
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        posts = PinnedPostService.get_user_pinned_posts(user)
        return StatusDone({
            'pinned_posts': posts,
            'max_count': PinnedPostService.MAX_PINNED_POSTS,
        })

    # POST, DELETE require authentication and ownership
    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN, '로그인이 필요합니다.')

    if request.user != user:
        return StatusError(ErrorCode.AUTHENTICATION, '권한이 없습니다.')

    if request.method == 'POST':
        post_url = request.POST.get('post_url', '')
        if not post_url:
            return StatusError(ErrorCode.INVALID_PARAMETER, '글 URL이 필요합니다.')

        try:
            PinnedPostService.add_pinned_post(user, post_url)
            return StatusDone()
        except PinnedPostError as e:
            return StatusError(e.code, e.message)

    if request.method == 'DELETE':
        delete = QueryDict(request.body)
        post_url = delete.get('post_url', '')
        if not post_url:
            return StatusError(ErrorCode.INVALID_PARAMETER, '글 URL이 필요합니다.')

        try:
            PinnedPostService.remove_pinned_post(user, post_url)
            return StatusDone()
        except PinnedPostError as e:
            return StatusError(e.code, e.message)

    raise Http404


def pinned_posts_order(request, username):
    """
    Reorder pinned posts for a user.

    PUT: Update the order of pinned posts
    """
    user = get_object_or_404(User, username=username)

    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN, '로그인이 필요합니다.')

    if request.user != user:
        return StatusError(ErrorCode.AUTHENTICATION, '권한이 없습니다.')

    if request.method == 'PUT':
        put = QueryDict(request.body)
        post_urls_str = put.get('post_urls', '[]')

        try:
            post_urls = json.loads(post_urls_str)
        except json.JSONDecodeError:
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

        if not isinstance(post_urls, list):
            return StatusError(ErrorCode.INVALID_PARAMETER, '잘못된 형식입니다.')

        try:
            PinnedPostService.reorder_pinned_posts(user, post_urls)
            return StatusDone()
        except PinnedPostError as e:
            return StatusError(e.code, e.message)

    raise Http404


def pinnable_posts(request, username):
    """
    Get posts that can be pinned by the user.

    GET: Get all pinnable posts (non-hidden, not already pinned)
    """
    user = get_object_or_404(User, username=username)

    if not request.user.is_authenticated:
        return StatusError(ErrorCode.NEED_LOGIN, '로그인이 필요합니다.')

    if request.user != user:
        return StatusError(ErrorCode.AUTHENTICATION, '권한이 없습니다.')

    if request.method == 'GET':
        posts = PinnedPostService.get_pinnable_posts(user)
        return StatusDone({
            'posts': posts,
        })

    raise Http404
