from itertools import chain
from django.core.cache import cache
from django.db.models import F, Count, Case, When
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import *
from modules.response import StatusDone, StatusError
from board.views import function as fn

def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        if request.GET.get('includes'):
            includes = request.GET.get('includes').split(',')
            user_profile = Profile.objects.get(user=user)
            data = dict()
            for include in set(includes):
                if include == 'subscribe':
                    data[include] = {
                        'has_subscribe': Follow.objects.filter(
                            follower__id=request.user.id,
                            following=user.profile
                        ).exists()
                    }

                if include == 'profile':
                    data[include] = {
                        'image': user_profile.get_thumbnail(),
                        'username': user.username,
                        'realname': user.first_name,
                        'bio': user_profile.bio,
                        'has_subscribe': Follow.objects.filter(
                            follower__id=request.user.id,
                            following=user.profile
                        ).exists()
                    }
                
                elif include == 'social':
                    data[include] = user_profile.collect_social()
                    data[include]['username'] = user.username

                elif include == 'heatmap':
                    standard_date = timezone.now() - datetime.timedelta(days=365)
                    posts = Post.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        author=user,
                        config__hide=False
                    )
                    series = Series.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        owner=user
                    )
                    comments = Comment.objects.filter(
                        created_date__gte=standard_date,
                        created_date__lte=timezone.now(),
                        author=user,
                        post__config__hide=False
                    )
                    activity = chain(posts, series, comments)

                    heatmap = dict()
                    for element in activity:
                        key = timestamp(element.created_date, kind='grass')[:10]
                        if key in heatmap:
                            heatmap[key] += 1
                        else:
                            heatmap[key] = 1
                    data[include] = heatmap

                elif include == 'tags':
                    tags = Tag.objects.filter(
                        posts__author=user,
                        posts__config__hide=False,
                    ).annotate(
                        count=Count(
                            Case(
                                When(
                                    posts__author=user,
                                    posts__config__hide=False,
                                    then='posts'
                                ),
                            )
                        )
                    ).order_by('-count')
                    
                    data[include] = list(map(lambda tag: {
                        'name': tag.value,
                        'count': tag.count,
                    }, tags))
                
                elif include == 'most':
                    cache_key = user.username + '_most_trendy'
                    posts = cache.get(cache_key)
                    if not posts:
                        posts = Post.objects.filter(
                            author=user,
                            config__hide=False,
                            config__notice=False,
                            created_date__lte=timezone.now(),
                        ).annotate(
                            author_username=F('author__username'),
                            author_image=F('author__profile__avatar')
                        )
                        posts = sorted(posts, key=lambda instance: instance.trendy(), reverse=True)[:6]
                        cache.set(cache_key, posts, 7200)
                    data[include] = list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'image': str(post.image),
                        'read_time': post.read_time,
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                        'author_image': post.author_image,
                        'author': post.author_username,
                    }, posts))
                
                elif include == 'recent':
                    seven_days_ago = timezone.now() - datetime.timedelta(days=7)
                    posts = Post.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        author=user,
                        config__hide=False
                    ).order_by('-created_date')
                    series = Series.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        owner=user
                    ).order_by('-created_date')
                    comments = Comment.objects.filter(
                        created_date__gte=seven_days_ago,
                        created_date__lte=timezone.now(),
                        author=user,
                        post__config__hide=False
                    ).order_by('-created_date')
                    activity = sorted(chain(posts, series, comments), key=lambda instance: instance.created_date, reverse=True)
                    data[include] = list()
                    for active in activity:
                        active_dict = dict()
                        active_type = str(type(active))
                        if 'Post' in active_type:
                            active_dict = {
                                'type': 'edit',
                                'text': active.title
                            }
                        elif 'Comment' in active_type:
                            active_dict = {
                                'type': 'comment',
                                'text': active.post.title
                            }
                        elif 'Series' in active_type:
                            active_dict = {
                                'type': 'bookmark',
                                'text': active.name
                            }
                        active_dict['url'] = active.get_absolute_url()
                        data[include].append(active_dict)
                
                elif include == 'about':
                    data[include] = user_profile.about_html
            
            return StatusDone(data)

        if not request.user.is_active:
            return StatusError('NL')
        
        if not request.user == user:
            return StatusError('DU')
        
        if request.GET.get('get') == 'about':
            return StatusDone({
                'about_md': user.profile.about_md
            })

    if request.method == 'PUT':
        put = QueryDict(request.body)
        if put.get('follow'):
            if not request.user.is_active:
                return StatusError('NL')
            if request.user == user:
                return StatusError('SU')
            
            follower = User.objects.get(username=request.user)
            follow_query = Follow.objects.filter(
                follower=follower,
                following=user.profile
            )
            if follow_query.exists():
                follow_query.delete()
                return StatusDone({ 'has_subscribe': False })
            else:
                Follow(follower=follower, following=user.profile).save()
                return StatusDone({ 'has_subscribe': True })
        
        if put.get('about'):
            if not request.user == user:
                return StatusError('DU')
            about_md = put.get('about_md')
            about_html = put.get('about_html')
            if hasattr(user, 'profile'):
                user.profile.about_md = about_md
                user.profile.about_html = about_html
                user.profile.save()
            else:
                profile = Profile(user=user)
                profile.about_md = about_md
                profile.about_html = about_html
                profile.save()
            
            return StatusDone()
    raise Http404