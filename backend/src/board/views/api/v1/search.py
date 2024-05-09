import datetime
import time

from django.db.models import F, Q, Count, When, Case, Subquery, OuterRef, BooleanField
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import Post, Search, SearchValue
from board.modules.analytics import create_device, get_network_addr
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
            created_date__lte=timezone.now(),
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
            thanks_count=Count('thanks', filter=Q(
                thanks__created_date__gte=timezone.now() - datetime.timedelta(days=180)
            )),
            nothanks_count=Count('nothanks', filter=Q(
                nothanks__created_date__gte=timezone.now() - datetime.timedelta(days=180)
            )),
            score=F('thanks_count') - F('nothanks_count'),
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
            '-score',
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

        user_addr = get_network_addr(request)
        user_agent = request.META['HTTP_USER_AGENT']
        device = create_device(user_addr, user_agent)

        search_value, search_value_created = SearchValue.objects.get_or_create(
            value=query,
        )
        if not username:
            search_value.reference_count = total_size
        search_value.save()

        six_hours_ago = timezone.now() - datetime.timedelta(hours=6)
        has_search_query = Search.objects.filter(
            device=device,
            search_value=search_value,
            created_date__gt=six_hours_ago,
        )

        if request.user.id:
            if has_search_query.exists():
                has_search_query.update(user=request.user)
            else:
                Search.objects.create(
                    user=request.user,
                    device=device,
                    search_value=search_value,
                )
        else:
            if not has_search_query.exists():
                Search.objects.create(
                    device=device,
                    search_value=search_value,
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


def search_history_list(request):
    if request.method == 'GET':
        if request.user.id:
            searches = Search.objects.filter(
                user=request.user.id
            ).annotate(
                value=F('search_value__value')
            ).order_by('-created_date')[:4]

            return StatusDone({
                'searches': list(map(lambda item: {
                    'pk': item.id,
                    'id': item.id,
                    'value': item.value,
                    'created_date': convert_to_localtime(item.created_date).strftime('%Y. %m. %d.'),
                }, searches))
            })
        else:
            return StatusDone({
                'searches': [],
            })

    raise Http404


def search_history_detail(request, item_id: int):
    if request.method == 'DELETE':
        if request.user.id:
            search_item = get_object_or_404(
                Search, id=item_id, user=request.user.id)
            search_item.user = None
            search_item.save()
            return StatusDone()

    raise Http404


def search_suggest(request):
    if request.method == 'GET':
        query = request.GET.get('q', '')[:20].lower()

        search_values = SearchValue.objects.filter(
            Q(value__startswith=query) | Q(value__contains=query),
            reference_count__gt=0,
        ).annotate(
            is_startswith=Case(
                When(value__startswith=query, then=True),
                default=False,
            ),
            is_contain=Case(
                When(value__contains=query, then=True),
                default=False,
            ),
        ).order_by('-is_startswith', 'value', '-is_contain')[:4]

        return StatusDone({
            'results': list(map(lambda item: item.value, search_values))
        })

    raise Http404
