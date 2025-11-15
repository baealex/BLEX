import datetime
import time

from django.shortcuts import render
from django.core.paginator import Paginator as DjangoPaginator, EmptyPage, PageNotAnInteger
from django.db.models import F, Q, Count, When, Case, Subquery, OuterRef, BooleanField
from django.utils import timezone
from django.contrib.auth.models import User

from board.models import Post
from board.modules.paginator import Paginator
from board.modules.time import convert_to_localtime

def search_view(request):
    """
    검색 페이지 뷰 - 포스트 검색만 지원
    """
    # 쿼리 파라미터 가져오기
    query = request.GET.get('q', '')[:20]
    page = int(request.GET.get('page', 1))
    results = []
    total_size = 0
    elapsed_time = 0
    
    # 검색어가 있을 경우 검색 실행
    if query:
        start_time = time.time()
        
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

        elapsed_time = round(time.time() - start_time, 3)

        context = {
            'query': query,
            'results': results,
            'total_size': total_size,
            'elapsed_time': elapsed_time,
            'page': page,
            'page_count': (total_size + 9) // 10,
        }

        return render(request, 'board/search/search_posts.html', context)

    return render(request, 'board/search/search_posts.html', {})
