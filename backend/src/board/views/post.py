from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.http import Http404
from django.contrib import messages

from board.models import Post, Series, PostLikes, TempPosts, UsernameChangeLog, Banner
from board.services.post_service import PostService, PostValidationError

def post_detail(request, username, post_url):
    """
    View for the post detail page.
    """
    # Check if this is an old username in the change log
    username_log = UsernameChangeLog.objects.filter(username=username).select_related('user', 'user__profile').first()
    if username_log:
        if username_log.user.profile.is_editor():
            return redirect('post_detail', username=username_log.user.username, post_url=post_url)

    author = get_object_or_404(User, username=username)

    try:
        post = Post.objects.select_related(
            'config', 'series', 'author', 'author__profile'
        ).filter(
            author=author,
            url=post_url,
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
        ).get()
    except Post.DoesNotExist:
        raise Http404("Post does not exist")
    
    if post.config.hide and (not request.user.is_authenticated or request.user != author):
        raise Http404("Post does not exist")

    post.created_date_display = post.created_date.strftime('%Y-%m-%d')
    
    # Initialize series attributes to avoid AttributeError
    post.series_total = 0
    post.visible_series_posts = []
    post.prev_post = None
    post.next_post = None

    if post.series:
        post.visible_series_posts = PostService.get_visible_series_posts(post)

    # Fetch active banners for the post author
    banners = {
        'top': Banner.objects.filter(
            user=author,
            is_active=True,
            banner_type=Banner.BannerType.HORIZONTAL,
            position=Banner.Position.TOP
        ).order_by('order', '-created_date'),
        'bottom': Banner.objects.filter(
            user=author,
            is_active=True,
            banner_type=Banner.BannerType.HORIZONTAL,
            position=Banner.Position.BOTTOM
        ).order_by('order', '-created_date'),
        'left': Banner.objects.filter(
            user=author,
            is_active=True,
            banner_type=Banner.BannerType.SIDEBAR,
            position=Banner.Position.LEFT
        ).order_by('order', '-created_date'),
        'right': Banner.objects.filter(
            user=author,
            is_active=True,
            banner_type=Banner.BannerType.SIDEBAR,
            position=Banner.Position.RIGHT
        ).order_by('order', '-created_date'),
    }
    
    context = {
        'post': post,
        'banners': banners,
    }
    
    return render(request, 'board/posts/post_detail.html', context)


def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    if not request.user.is_authenticated:
        return redirect('login')
    
    if not request.user.profile.is_editor():
        messages.error(request, '편집자 권한이 필요합니다. 관리자에게 문의하세요.')
        return redirect('index')

    is_edit = username is not None and post_url is not None
    post = None
    temp_post = None
    series_list = []
    
    temp_token = request.GET.get('temp_token') or request.GET.get('tempToken')
    if temp_token and not is_edit:
        try:
            temp_post = TempPosts.objects.get(token=temp_token, author=request.user)
        except TempPosts.DoesNotExist:
            pass
    
    if is_edit:
        author = get_object_or_404(User, username=username)
        
        if request.user != author:
            raise Http404("You don't have permission to edit this post")
        
        try:
            post = Post.objects.select_related('config', 'series', 'content').get(
                author=author,
                url=post_url,
            )
        except Post.DoesNotExist:
            raise Http404("Post does not exist")
    
    series_list = Series.objects.filter(owner=request.user).order_by('-updated_date')
    
    if request.method == 'POST':
        if is_edit and request.POST.get('delete') == 'true':
            PostService.delete_post(post)
            messages.success(request, 'Post has been deleted successfully.')
            return redirect('user_profile', username=request.user.username)
        
        title = request.POST.get('title')
        url = request.POST.get('url')
        text_html = request.POST.get('text_md')  # Now receiving HTML directly from editor
        text_md = text_html  # Keep text_md for backward compatibility, but it's now HTML
        meta_description = request.POST.get('meta_description', '')
        tags_str = request.POST.get('tag', '')
        series_id = request.POST.get('series', '')
        
        tags = []
        if tags_str:
            tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
        
        hide = request.POST.get('hide') in ['on', 'true']
        notice = request.POST.get('notice') in ['on', 'true']
        advertise = request.POST.get('advertise') in ['on', 'true']
        is_draft = request.POST.get('is_draft') == 'true'
        
        series = None
        if series_id:
            try:
                series = Series.objects.get(id=series_id, owner=request.user)
            except Series.DoesNotExist:
                pass
        
        if is_edit:
            image = None
            if 'image' in request.FILES:
                image = request.FILES['image']
            elif request.POST.get('remove_image') == 'true':
                image = None  # This will be handled separately

            PostService.update_post(
                post=post,
                title=title,
                text_html=text_html,
                description=meta_description,
                series_url=series.url if series else None,
                tag=','.join(tags) if tags else None,
                image=image,
                is_hide=hide,
                is_notice=notice,
                is_advertise=advertise,
            )

            if request.POST.get('remove_image') == 'true':
                post.image = None
                post.save()

            messages.success(request, 'Post has been updated successfully.')
        else:
            image = request.FILES.get('image', None)

            temp_token = request.POST.get('token', '')

            try:
                post, post_content, post_config = PostService.create_post(
                    user=request.user,
                    title=title,
                    text_html=text_html,
                    description=meta_description,
                    series_url=series.url if series else '',
                    custom_url=url,
                    tag=','.join(tags) if tags else '',
                    image=image,
                    is_hide=hide,
                    is_notice=notice,
                    is_advertise=advertise,
                    temp_post_token=temp_token,
                )
                messages.success(request, 'Post has been created successfully.')
            except PostValidationError as e:
                messages.error(request, e.message)
                return redirect('post_write')
        
        if is_draft:
            messages.success(request, '포스트가 임시저장되었습니다.')
            return redirect('post_edit', username=request.user.username, post_url=post.url)

        return redirect('post_detail', username=request.user.username, post_url=post.url)
    
    context = {
        'is_edit': is_edit,
        'post': post,
        'temp_post': temp_post,
        'series_list': series_list,
        'is_editor_page': True,
    }
    
    return render(request, 'board/posts/post_editor.html', context)
