import re

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import F, Count, Case, When, Exists, OuterRef, Value
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.constants.config_meta import CONFIG_TYPE
from board.models import Comment, Post
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.paginator import Paginator
from board.services.comment_service import CommentService, CommentValidationError
from modules import markdown


def comment_list(request):
    """Create a new comment using CommentService"""
    if request.method == 'POST':
        try:
            post = get_object_or_404(Post, url=request.GET.get('url'))
            text_md = request.POST.get('comment_md', '')

            # Create comment using service
            comment = CommentService.create_comment(
                user=request.user,
                post=post,
                text_md=text_md
            )

            return StatusDone({
                'id': comment.id,
                'author': comment.author.username,
                'author_image': comment.author.profile.get_thumbnail(),
                'is_edited': comment.edited,
                'rendered_content': comment.text_html,
                'created_date': comment.time_since(),
                'count_likes': 0,
                'is_liked': False,
            })

        except CommentValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def comment_detail(request, id):
    comment = get_object_or_404(Comment.objects.select_related(
        'author',
        'author__config'
    ).annotate(
        count_likes=Count('likes', distinct=True),
        has_liked=Case(
            When(
                Exists(
                    Comment.objects.filter(
                        id=OuterRef('id'),
                        likes__id=request.user.id if request.user.id else -1
                    )
                ),
                then=Value(True)
            ),
            default=Value(False),
        )
    ), id=id)

    if request.method == 'GET':
        return StatusDone({
            'text_md': comment.text_md,
        })

    if request.method == 'PUT':
        body = QueryDict(request.body)

        if body.get('like'):
            if not request.user.is_active:
                return StatusError(ErrorCode.NEED_LOGIN)

            if request.user == comment.author:
                return StatusError(ErrorCode.AUTHENTICATION)

            if comment.is_deleted():
                return StatusError(ErrorCode.REJECT)

            if comment.has_liked:
                comment.likes.remove(request.user)
                return StatusDone({
                    'count_likes': comment.count_likes - 1,
                })
            else:
                comment.likes.add(request.user)
                if comment.author.config.get_meta(CONFIG_TYPE.NOTIFY_COMMENT_LIKE):
                    send_notify_content = (
                        f"'{comment.post.title}'글에 작성한 "
                        f"회원님의 #{comment.pk} 댓글을 "
                        f"@{request.user.username}님께서 추천했습니다.")
                    create_notify(
                        user=comment.author,
                        url=comment.post.get_absolute_url(),
                        content=send_notify_content)
                return StatusDone({
                    'count_likes': comment.count_likes + 1,
                })

        if body.get('comment'):
            if not request.user == comment.author:
                return StatusError(ErrorCode.AUTHENTICATION)

            text_md = body.get('comment_md')
            text_html = markdown.parse_to_html(text_md)

            comment.text_md = text_md
            comment.text_html = text_html
            comment.edited = True
            comment.save()
            return StatusDone()

    if request.method == 'DELETE':
        if not request.user == comment.author:
            return StatusError(ErrorCode.AUTHENTICATION)

        comment.author = None
        comment.save()
        return StatusDone({
            'author': comment.author_username(),
            'author_image': None if not comment.author else comment.author.profile.get_thumbnail(),
            'rendered_content': comment.get_text_html(),
        })

    raise Http404


def user_comment(request):
    if request.method == 'GET':
        comments = Comment.objects.filter(
            author=request.user,
        ).annotate(
            post_author=F('post__author__username'),
            post_title=F('post__title'),
            post_url=F('post__url'),
        ).order_by('-created_date')

        comments = Paginator(
            objects=comments,
            offset=10,
            page=request.GET.get('page', 1)
        )
        return StatusDone({
            'comments': list(map(lambda comment: {
                'posts': {
                    'author': comment.post_author,
                    'title': comment.post_title,
                    'url': comment.post_url,
                },
                'content': comment.text_html,
                'created_date': comment.time_since(),
            }, comments)),
            'last_page': comments.paginator.num_pages,
        })

    raise Http404
