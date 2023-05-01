import re

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import F
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils.html import strip_tags

from board.models import Comment, Post
from board.modules.notify import create_notify
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.paginator import Paginator
from modules import markdown


def comment_list(request):
    if request.method == 'POST':
        if not request.user.is_active:
            return StatusError(ErrorCode.AUTHENTICATION)

        post = get_object_or_404(Post, url=request.GET.get('url'))

        text_md = request.POST.get('comment_md', '')
        text_html = markdown.parse_to_html(settings.API_URL, markdown.ParseData.from_dict({
            'text': text_md,
            'token': settings.API_KEY,
        }))

        comment = Comment(
            post=post,
            author=request.user,
            text_md=text_md,
            text_html=text_html
        )
        comment.save()
        comment.refresh_from_db()

        content = strip_tags(text_html)[:50]
        if not comment.author == post.author:
            send_notify_content = (
                f"'{post.title}'글에 "
                f"@{comment.author.username}님이 댓글을 남겼습니다. "
                f"> {content} …")
            create_notify(
                user=post.author,
                url=post.get_absolute_url(),
                infomation=send_notify_content)

        regex = re.compile(r'\`\@([a-zA-Z0-9\.]*)\`\s?')
        if regex.search(comment.text_md):
            tag_user_list = regex.findall(comment.text_md)
            tag_user_list = set(tag_user_list)

            commentors = Comment.objects.filter(
                post=post).values_list('author__username')
            commentors = set(map(lambda instance: instance[0], commentors))

            for tag_user in tag_user_list:
                if tag_user in commentors:
                    _user = User.objects.get(username=tag_user)
                    if not _user == request.user:
                        send_notify_content = (
                            f"'{post.title}' 글에서 "
                            f"@{request.user.username}님이 "
                            f"회원님을 태그했습니다. #{comment.pk}")
                        create_notify(
                            user=_user,
                            url=post.get_absolute_url(),
                            infomation=send_notify_content)

        return StatusDone({
            'pk': comment.pk,
            'author': comment.author.username,
            'author_image': comment.author.profile.get_thumbnail(),
            'is_edited': comment.edited,
            'text_html': comment.text_html,
            'created_date': comment.time_since(),
            'total_likes': 0,
            'is_liked': False,
        })

    raise Http404


def comment_detail(request, id):
    comment = get_object_or_404(Comment, id=id)

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

            user = User.objects.get(username=request.user)
            if comment.likes.filter(id=user.id).exists():
                comment.likes.remove(user)
                comment.save()
            else:
                comment.likes.add(user)
                comment.save()
                send_notify_content = (
                    f"'{comment.post.title}'글에 작성한 "
                    f"회원님의 #{comment.pk} 댓글을 "
                    f"@{user.username}님께서 추천했습니다.")
                create_notify(
                    user=comment.author,
                    url=comment.post.get_absolute_url(),
                    infomation=send_notify_content)
            return StatusDone({
                'total_likes': comment.total_likes()
            })

        if body.get('comment'):
            if not request.user == comment.author:
                return StatusError(ErrorCode.AUTHENTICATION)

            text_md = body.get('comment_md')
            text_html = markdown.parse_to_html(settings.API_URL, markdown.ParseData.from_dict({
                'text': text_md,
                'token': settings.API_KEY,
            }))

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
            'author_image': comment.author_thumbnail(),
            'text_html': comment.get_text_html(),
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
