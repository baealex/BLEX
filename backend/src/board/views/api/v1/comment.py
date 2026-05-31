from django.db.models import F
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404

from board.models import Comment, Post
from board.modules.response import StatusDone, StatusError
from board.modules.paginator import Paginator
from board.services.comment_list_service import CommentListService
from board.services.comment_service import CommentService, CommentValidationError
from board.services.public_post_service import PublicPostService


def comment_list(request):
    if request.method == 'POST':
        try:
            post = get_object_or_404(
                PublicPostService.filter_public_posts(
                    Post.objects.select_related('config')
                ),
                url=request.GET.get('url')
            )
            text_md = request.POST.get('comment_md', '')
            parent_id = request.POST.get('parent_id')

            parent = None
            if parent_id:
                parent = get_object_or_404(Comment, id=parent_id)

            comment = CommentService.create_comment(
                user=request.user,
                post=post,
                text_md=text_md,
                parent=parent
            )

            return StatusDone(CommentListService.serialize_created_comment(
                comment,
                request.user,
            ))

        except CommentValidationError as e:
            return StatusError(e.code, e.message)

    raise Http404


def comment_detail(request, id):
    comment = get_object_or_404(
        CommentService.get_comment_queryset(request.user),
        id=id,
    )

    if request.method == 'GET':
        try:
            return StatusDone({
                'text_md': CommentService.get_edit_markdown(request.user, comment),
            })
        except CommentValidationError as e:
            return StatusError(e.code, e.message)

    if request.method == 'PUT':
        body = QueryDict(request.body)

        if body.get('like'):
            try:
                is_liked, count_likes = CommentService.toggle_public_comment_like(
                    request.user,
                    comment,
                )
                return StatusDone({
                    'is_liked': is_liked,
                    'count_likes': count_likes,
                })
            except CommentValidationError as e:
                return StatusError(e.code, e.message)

        if body.get('comment'):
            try:
                CommentService.update_public_comment(
                    request.user,
                    comment,
                    body.get('comment_md', ''),
                )
                return StatusDone()
            except CommentValidationError as e:
                return StatusError(e.code, e.message)

    if request.method == 'DELETE':
        try:
            CommentService.delete_public_comment(request.user, comment)
            return StatusDone(CommentListService.serialize_created_comment(
                comment,
                request.user,
            ))
        except CommentValidationError as e:
            return StatusError(e.code, e.message)

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
