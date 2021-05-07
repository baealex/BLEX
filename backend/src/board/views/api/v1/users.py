from itertools import chain
from django.http import Http404, QueryDict
from django.shortcuts import get_object_or_404
from django.utils import timezone

from board.models import *
from board.module.response import StatusDone, StatusError
from board.views import function as fn

def users(request, username):
    user = get_object_or_404(User, username=username)

    if request.method == 'GET':
        if request.GET.get('includes'):
            includes = request.GET.get('includes').split(',')
            user_profile = Profile.objects.get(user=user)
            data = dict()
            for include in includes:
                if include == 'profile':
                    data[include] = {
                        'image': user_profile.get_thumbnail(),
                        'username': user.username,
                        'realname': user.first_name,
                        'bio': user_profile.bio
                    }
                
                elif include == 'social':
                    data[include] = user_profile.collect_social()
                    data[include]['username'] = user.username

                elif include == 'heatmap':
                    standard_date = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=365)))
                    posts = Post.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, hide=False)
                    series = Series.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), owner=user)
                    comments = Comment.objects.filter(created_date__gte=standard_date, created_date__lte=timezone.now(), author=user, post__hide=False)
                    activity = chain(posts, series, comments)

                    heatmap = dict()
                    for element in activity:
                        key = timestamp(convert_to_localtime(element.created_date), kind='grass')[:10]
                        if key in heatmap:
                            heatmap[key] += 1
                        else:
                            heatmap[key] = 1
                    data[include] = heatmap

                elif include == 'tags':
                    data[include] = fn.get_user_topics(user=user, include='posts')
                
                elif include == 'most':
                    data[include] = list(map(lambda post: {
                        'url': post.url,
                        'title': post.title,
                        'image': post.get_thumbnail(),
                        'read_time': post.read_time(),
                        'created_date': convert_to_localtime(post.created_date).strftime('%Y년 %m월 %d일'),
                        'author_image': post.author.profile.get_thumbnail(),
                        'author': post.author.username,
                    }, fn.get_posts('trendy', user)[:6]))
                
                elif include == 'recent':
                    seven_days_ago = convert_to_localtime(timezone.make_aware(datetime.datetime.now() - datetime.timedelta(days=7)))
                    posts = Post.objects.filter(created_date__gte=seven_days_ago, author=user, hide=False).order_by('-created_date')
                    series = Series.objects.filter(created_date__gte=seven_days_ago, owner=user, hide=False).order_by('-created_date')
                    comments = Comment.objects.filter(created_date__gte=seven_days_ago, author=user, post__hide=False).order_by('-created_date')
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
            if hasattr(user, 'profile'):
                if user.profile.subscriber.filter(id = follower.id).exists():
                    user.profile.subscriber.remove(follower)
                else:
                    user.profile.subscriber.add(follower)
            else:
                profile = Profile(user=user)
                profile.save()
                profile.subscriber.add(follower)
            return StatusDone({
                'total_subscriber': user.profile.total_subscriber()
            })
        
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
        
        if put.get('username'):
            if not request.user == user:
                return StatusError('DU')
            posts = Post.objects.filter(author=request.user)
            comments = Comment.objects.filter(author=request.user)
            if posts.count() > 0 or comments.count() > 0:
                return StatusError('RJ')

            new_username = put.get('new_username')
            has_username = User.objects.filter(username=new_username)
            if has_username.exists():
                return StatusError('AE')
            
            user.username = new_username
            user.save()
            return StatusDone()
    
    raise Http404