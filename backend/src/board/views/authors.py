import time
import datetime

from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Count, Q, Subquery, OuterRef, IntegerField, F
from django.utils import timezone
from django.core.paginator import Paginator as DjangoPaginator, EmptyPage, PageNotAnInteger

from board.models import Follow, Search, SearchValue
from board.modules.analytics import create_device, get_network_addr


def authors_view(request):
    """
    Authors page view - Lists all authors and provides search functionality for authors
    """
    # Get query parameter for search
    query = request.GET.get('q', '')
    page = int(request.GET.get('page', 1))
    results = []
    total_size = 0
    elapsed_time = 0
    
    # If search query is provided, search for authors
    if query:
        start_time = time.time()
        
        # 프로필 서브쿼리를 사용하여 팔로워 수 가져오기
        follower_count_subquery = Follow.objects.filter(
            following=OuterRef('profile')
        ).values('following').annotate(
            count=Count('*')
        ).values('count')
        
        # Search for users
        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(profile__bio__icontains=query)
        ).annotate(
            post_count=Count('post', filter=Q(post__config__hide=False)),
            avatar=F('profile__avatar'),
            follower_count=Subquery(follower_count_subquery, output_field=IntegerField())
        ).order_by('-post_count')
        
        # Paginate results
        paginator = DjangoPaginator(users, 10)
        try:
            paginated_users = paginator.page(page)
        except PageNotAnInteger:
            paginated_users = paginator.page(1)
        except EmptyPage:
            paginated_users = paginator.page(paginator.num_pages)
        
        # Format results
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
        
        # Save search history
        user_addr = get_network_addr(request)
        user_agent = request.META['HTTP_USER_AGENT']
        device = create_device(user_addr, user_agent)
        
        search_value, search_value_created = SearchValue.objects.get_or_create(
            value=query,
        )
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
            'results': results,
            'total_size': total_size,
            'elapsed_time': elapsed_time,
            'page': page,
            'page_count': paginator.num_pages,
        }
    else:
        # If no search query, list all authors
        follower_count_subquery = Follow.objects.filter(
            following=OuterRef('profile')
        ).values('following').annotate(
            count=Count('*')
        ).values('count')
        
        # Get all authors with post count and follower count
        authors = User.objects.annotate(
            post_count=Count('post', filter=Q(post__config__hide=False)),
            avatar=F('profile__avatar'),
            follower_count=Subquery(follower_count_subquery, output_field=IntegerField())
        ).filter(
            post_count__gt=0
        ).order_by('-post_count')
        
        # Paginate results
        paginator = DjangoPaginator(authors, 24)
        try:
            paginated_authors = paginator.page(page)
        except PageNotAnInteger:
            paginated_authors = paginator.page(1)
        except EmptyPage:
            paginated_authors = paginator.page(paginator.num_pages)
        
        # Format results
        authors_list = []
        for author in paginated_authors:
            authors_list.append({
                'username': author.username,
                'name': author.first_name,
                'bio': author.profile.bio if hasattr(author, 'profile') and author.profile else '',
                'avatar': author.profile.get_thumbnail(),
                'post_count': author.post_count,
                'follower_count': author.follower_count or 0,
            })
        
        context = {
            'authors': authors_list,
            'page': page,
            'page_count': paginator.num_pages,
        }
    
    return render(request, 'board/authors.html', context)
