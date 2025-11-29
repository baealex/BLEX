import time
import datetime

from django.shortcuts import render
from django.contrib.auth.models import User
from django.db.models import Count, Q, F
from django.utils import timezone
from django.core.paginator import Paginator as DjangoPaginator, EmptyPage, PageNotAnInteger


def authors_view(request):
    """
    Authors page view - Lists all authors and provides search functionality for authors
    """
    query = request.GET.get('q', '')
    page = int(request.GET.get('page', 1))
    results = []
    total_size = 0
    elapsed_time = 0
    
    if query:
        start_time = time.time()

        users = User.objects.filter(
            Q(username__icontains=query) |
            Q(first_name__icontains=query) |
            Q(profile__bio__icontains=query)
        ).annotate(
            post_count=Count('post', filter=Q(post__config__hide=False)),
            avatar=F('profile__avatar')
        ).order_by('-post_count')
        
        paginator = DjangoPaginator(users, 10)
        try:
            paginated_users = paginator.page(page)
        except PageNotAnInteger:
            paginated_users = paginator.page(1)
        except EmptyPage:
            paginated_users = paginator.page(paginator.num_pages)
        
        for user in paginated_users:
            results.append({
                'username': user.username,
                'name': user.first_name,
                'bio': user.profile.bio if hasattr(user, 'profile') and user.profile else '',
                'avatar': user.avatar if hasattr(user, 'avatar') and user.avatar else '/resources/assets/images/default-avatar.png',
                'post_count': user.post_count,
            })
        
        total_size = users.count()

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
        authors = User.objects.annotate(
            post_count=Count('post', filter=Q(post__config__hide=False)),
            avatar=F('profile__avatar')
        ).filter(
            post_count__gt=0
        ).order_by('-post_count')
        
        paginator = DjangoPaginator(authors, 24)
        try:
            paginated_authors = paginator.page(page)
        except PageNotAnInteger:
            paginated_authors = paginator.page(1)
        except EmptyPage:
            paginated_authors = paginator.page(paginator.num_pages)
        
        authors_list = []
        for author in paginated_authors:
            authors_list.append({
                'username': author.username,
                'name': author.first_name,
                'bio': author.profile.bio if hasattr(author, 'profile') and author.profile else '',
                'avatar': author.profile.get_thumbnail(),
                'post_count': author.post_count,
            })
        
        context = {
            'authors': authors_list,
            'page': page,
            'page_count': paginator.num_pages,
        }
    
    return render(request, 'board/search/search_authors.html', context)
