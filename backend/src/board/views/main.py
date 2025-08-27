from django.shortcuts import render
from django.utils import timezone
from django.db.models import F, Count, Exists, OuterRef, Sum, Q
from django.contrib.auth.decorators import login_required

from board.models import Post, PostLikes, Comment, PostAnalytics
from board.modules.paginator import Paginator


def index(request):
    """
    Main page view that renders the homepage with newest posts and handles search functionality.
    This replaces the frontend React component with a Django template.
    """
    # Get query parameter for search
    query = request.GET.get('q', '')
    
    if query:
        # Search functionality
        import time
        from django.db.models import Case, When, BooleanField
        from board.modules.time import convert_to_localtime
        from board.modules.analytics import create_device, get_network_addr
        from board.models import Search, SearchValue
        import datetime
        
        start_time = time.time()
        
        # Search posts
        search_posts = Post.objects.filter(
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
            author_username=F('author__username'),
            author_image=F('author__profile__avatar'),
        ).distinct()
        
        # Order by relevance
        search_posts = search_posts.order_by(
            '-is_contain_title',
            '-is_contain_tags',
            '-is_contain_description',
            '-is_contain_content',
            '-created_date'
        )
        
        # Paginate search results
        page = int(request.GET.get('page', 1))
        paginated_posts = Paginator(
            objects=search_posts,
            offset=10,
            page=page
        )
        
        # Format search results
        results = []
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
                'image': str(post.image) if hasattr(post, 'image') else '',
                'description': post.meta_description,
                'read_time': post.read_time if hasattr(post, 'read_time') else '',
                'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                'author_image': post.author_image,
                'author': post.author_username,
                'positions': positions,
            })
        
        # Save search history
        user_addr = get_network_addr(request)
        user_agent = request.META['HTTP_USER_AGENT']
        device = create_device(user_addr, user_agent)
        
        search_value, search_value_created = SearchValue.objects.get_or_create(
            value=query,
        )
        search_value.reference_count = paginated_posts.paginator.count
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
            'results': results,
            'total_size': paginated_posts.paginator.count,
            'elapsed_time': elapsed_time,
            'page': page,
            'page_count': paginated_posts.paginator.num_pages,
        }
        
        return render(request, 'board/index.html', context)
    
    # Regular index page (no search)
    posts = Post.objects.select_related(
        'config', 'series', 'author', 'author__profile'
    ).filter(
        created_date__lte=timezone.now(),
        config__notice=False,
        config__hide=False,
    ).annotate(
        author_username=F('author__username'),
        author_image=F('author__profile__avatar'),
        count_likes=Count('likes', distinct=True),
        count_comments=Count('comments', distinct=True),
        has_liked=Exists(
            PostLikes.objects.filter(
                post__id=OuterRef('id'),
                user__id=request.user.id if request.user.id else -1
            )
        ),
    )
    
    sort_type = request.GET.get('sort', 'latest')
    
    if sort_type == 'popular':
        posts = posts.order_by('-count_likes', '-created_date')
    elif sort_type == 'comments':
        posts = posts.order_by('-count_comments', '-created_date')
    else:
        posts = posts.order_by('-created_date')

    # Paginate the results
    page = int(request.GET.get('page', 1))
    paginated_posts = Paginator(
        objects=posts,
        offset=24,
        page=page
    )
    
    # Format dates and prepare context
    for post in paginated_posts:
        post.created_date = post.time_since()
    
    context = {
        'posts': paginated_posts,
        'page_number': page,
        'page_count': paginated_posts.paginator.num_pages,
    }
    
    return render(request, 'board/index.html', context)


