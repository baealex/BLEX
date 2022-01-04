import os
import re
import json
import time
import traceback

from django.conf import settings
from django.contrib.auth.models import User
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils.html import strip_tags
from django.utils.timesince import timesince

from board.models import Comment, Post
from modules.markdown import parse_to_html, ParseData
from modules.response import StatusDone, StatusError
from modules.subtask import sub_task_manager
from modules.telegram import TelegramBot
from board.views import function as fn

def comment(request, pk=None):
    if not pk:
        if request.method == 'POST':
            post = get_object_or_404(Post, url=request.GET.get('url'))
            body = QueryDict(request.body)

            text_md = body.get('comment_md')
            text_html = parse_to_html(settings.SITE_URL, ParseData.from_dict({
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

            content = strip_tags(body.get('comment_html'))[:50]
            if not comment.author == post.author:
                send_notify_content = (
                    f"'{post.title}'글에 "
                    f"@{comment.author.username}님이 댓글을 남겼습니다. "
                    f"> {content} …")
                fn.create_notify(
                    user=post.author,
                    url=post.get_absolute_url(),
                    infomation=send_notify_content)
            
            regex = re.compile(r'\`\@([a-zA-Z0-9\.]*)\`\s?')
            if regex.search(comment.text_md):
                tag_user_list = regex.findall(comment.text_md)
                tag_user_list = set(tag_user_list)

                commentors = Comment.objects.filter(post=post).values_list('author__username')
                commentors = set(map(lambda instance: instance[0], commentors))

                for tag_user in tag_user_list:
                    if tag_user in commentors:
                        _user = User.objects.get(username=tag_user)
                        if not _user == request.user:
                            send_notify_content = (
                                f"'{post.title}' 글에서 "
                                f"@{request.user.username}님이 "
                                f"회원님을 태그했습니다. #{comment.pk}")
                            fn.create_notify(
                                user=_user,
                                url=post.get_absolute_url(),
                                infomation=send_notify_content)
            
            return StatusDone({
                'pk': comment.pk,
                'author': comment.author.username,
                'author_image': comment.author.profile.get_thumbnail(),
                'is_edited': comment.edited,
                'text_html': comment.text_html,
                'time_since': timesince(comment.created_date),
                'total_likes': 0,
                'is_liked': False,
            })
    
    if pk:
        comment = get_object_or_404(Comment, pk=pk)

        if request.method == 'GET':
            return StatusDone({
                'text_md': comment.text_md,
            })

        if request.method == 'PUT':
            body = QueryDict(request.body)
            if body.get('like'):
                if not request.user.is_active:
                    return StatusError('NL')
                if request.user == comment.author:
                    return StatusError('SU')
                if comment.author == None:
                    return StatusError('RJ')
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
                    fn.create_notify(
                        user=comment.author,
                        url=comment.post.get_absolute_url(),
                        infomation=send_notify_content)
                return StatusDone({
                    'total_likes': comment.total_likes()
                })
            
            if body.get('comment'):
                if not request.user == comment.author:
                    return StatusError('DU')

                text_md = body.get('comment_md')
                text_html = parse_to_html(settings.SITE_URL, ParseData.from_dict({
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
                return StatusError('DU')
            comment.author = None
            comment.save()
            return StatusDone({
                'author': comment.author_username(),
                'author_image': comment.author_thumbnail(),
                'text_html': comment.get_text_html(),
            })
    
    raise Http404