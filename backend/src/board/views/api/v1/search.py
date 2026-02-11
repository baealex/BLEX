import datetime
import time

from django.db.models import F, Q, Count, When, Case, Subquery, OuterRef, BooleanField
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import Post
from board.modules.response import StatusDone, StatusError, ErrorCode
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime


def search(request):
    if request.method == 'GET':
        query = request.GET.get('q', '')[:20]
        username = request.GET.get('username', '')

        if len(query) < 0:
            return StatusError(ErrorCode.VALIDATE, '검색어를 입력하세요.')

        start_time = time.time()

        subqueries = Post.objects.filter(
            Q(title__contains=query) |
            Q(meta_description__contains=query) |
            Q(tags__value__contains=query) |
            Q(content__text_md__contains=query),
            config__hide=False,
            published_date__isnull=False,
            published_date__lte=timezone.now(),
        ).annotate(
            is_contain_title=Case(
                When(title__contains=query, then=True),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_description=Case(
                When(meta_description__contains=query, then=True),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_tags=Case(
                When(tags__value__contains=query, then=True),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_content=Case(
                When(content__text_md__contains=query, then=True),
                default=False,
                output_field=BooleanField(),
            ),
        ).distinct().values_list('id', flat=True)

        posts = Post.objects.filter(id__in=subqueries).annotate(
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
            likes_count=Count('likes'),
            is_contain_title=Case(
                When(
                    id__in=Subquery(
                        subqueries.filter(
                            id=OuterRef('id'),
                            is_contain_title=True
                        )
                    ),
                    then=True
                ),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_description=Case(
                When(
                    id__in=Subquery(
                        subqueries.filter(
                            id=OuterRef('id'),
                            is_contain_description=True
                        )
                    ),
                    then=True),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_tags=Case(
                When(
                    id__in=Subquery(
                        subqueries.filter(
                            id=OuterRef('id'),
                            is_contain_tags=True
                        )
                    ),
                    then=True),
                default=False,
                output_field=BooleanField(),
            ),
            is_contain_content=Case(
                When(
                    id__in=Subquery(
                        subqueries.filter(
                            id=OuterRef('id'),
                            is_contain_content=True
                        )
                    ),
                    then=True),
                default=False,
                output_field=BooleanField(),
            ),
        ).order_by(
            '-is_contain_title',
            '-is_contain_description',
            '-is_contain_tags',
            '-is_contain_content',
            '-likes_count',
            '-created_date',
        )

        if username:
            posts = posts.filter(author__username=username)

        total_size = posts.count()

        posts = Paginator(
            objects=posts,
            offset=30,
            page=request.GET.get('page', 1)
        )

        elapsed_time = round(time.time() - start_time, 3)
        return StatusDone({
            'elapsed_time': elapsed_time,
            'total_size': total_size,
            'last_page': posts.paginator.num_pages,
            'query': query,
            'results': list(map(lambda post: {
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.meta_description,
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'positions': list(filter(lambda item: item, [
                    '제목' if post.is_contain_title else '',
                    '설명' if post.is_contain_description else '',
                    '태그' if post.is_contain_tags else '',
                    '내용' if post.is_contain_content else '',
                ])),
            }, posts)),
        })

    raise Http404

