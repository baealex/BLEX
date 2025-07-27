import datetime
import time

from django.shortcuts import render
from django.core.paginator import Paginator as DjangoPaginator, EmptyPage, PageNotAnInteger
from django.db.models import F, Q, Count, When, Case, Subquery, OuterRef, BooleanField, Value, IntegerField
from django.utils import timezone
from django.contrib.auth.models import User

from board.models import Post, Search, SearchValue, Follow
from board.modules.analytics import create_device, get_network_addr
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime

def search_view(request):
    """
    검색 페이지 뷰 - 네이티브 구현
    """
    # 쿼리 파라미터 가져오기
    query = request.GET.get('q', '')[:20]
    username = request.GET.get('u', '')
    page = int(request.GET.get('page', 1))
    search_type = request.GET.get('type', 'post')  # 'post' 또는 'user'
    results = []
    total_size = 0
    elapsed_time = 0
    search_history = []
    
    # 검색어가 있을 경우 검색 실행
    if query:
        start_time = time.time()
        
        if search_type == 'user':
            # 프로필 서브쿼리를 사용하여 팔로워 수 가져오기
            follower_count_subquery = Follow.objects.filter(following=OuterRef('profile')).values('following').annotate(count=Count('*')).values('count')
            
            users = User.objects.filter(
                Q(username__icontains=query) |
                Q(first_name__icontains=query) |
                Q(profile__bio__icontains=query)
            ).annotate(
                post_count=Count('post', filter=Q(post__config__hide=False)),
                avatar=F('profile__avatar'),
                follower_count=Subquery(follower_count_subquery, output_field=IntegerField())
            ).order_by('-post_count')
            
            # 페이지네이션
            paginator = DjangoPaginator(users, 10)
            try:
                paginated_users = paginator.page(page)
            except PageNotAnInteger:
                paginated_users = paginator.page(1)
            except EmptyPage:
                paginated_users = paginator.page(paginator.num_pages)
            
            # 결과 포맷팅
            for user in paginated_users:
                results.append({
                    'username': user.username,
                    'name': user.first_name,
                    'bio': user.profile.bio if hasattr(user, 'profile') and user.profile else '',
                    'avatar': user.avatar if hasattr(user, 'avatar') and user.avatar else '/static/images/default-avatar.png',
                    'post_count': user.post_count,
                    'follower_count': user.follower_count or 0,
                })
            
            total_size = users.count()
            
        else:  # 기본값: 'post'
            # 게시글 검색 쿼리 실행
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
                '-created_date'
            )

            # 페이지네이션
            paginated_posts = Paginator(
                objects=posts,
                offset=10,
                page=page
            )
            
            total_size = paginated_posts.paginator.count
            
            # 검색 결과 형식화
            for post in paginated_posts:
                positions = []
                if post.is_contain_title:
                    positions.append('제목')
                if post.is_contain_description:
                    positions.append('설명')
                if post.is_contain_tags:
                    positions.append('태그')
                if post.is_contain_content:
                    positions.append('내용')
                    
                results.append({
                    'url': post.url,
                    'title': post.title,
                    'image': str(post.image),
                    'description': post.meta_description,
                    'read_time': post.read_time,
                    'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                    'author_image': post.author_image,
                    'author': post.author_username,
                    'positions': positions,
                })
            
            # 검색 기록 저장
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
        
            total_size = paginated_posts.paginator.count

            # 검색 결과 형식화
            for post in paginated_posts:
                positions = []
                if post.is_contain_title:
                    positions.append('제목')
                if post.is_contain_description:
                    positions.append('설명')
                if post.is_contain_tags:
                    positions.append('태그')
                if post.is_contain_content:
                    positions.append('내용')

            results.append({
                'url': post.url,
                'title': post.title,
                'image': str(post.image),
                'description': post.meta_description,
                'read_time': post.read_time,
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'positions': positions,
            })

        # 검색 기록 저장
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

        context = {
            'query': query,
            'username': username,
            'results': results,
            'total_size': total_size,
            'elapsed_time': elapsed_time,
            'search_history': search_history,
            'page': page,
            'page_count': (total_size + 9) // 10,
            'search_type': search_type,
        }

        return render(request, 'board/search.html', context)

    return render(request, 'board/search.html', {})
