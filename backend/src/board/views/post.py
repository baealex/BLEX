from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.http import Http404
from django.contrib import messages

from board.models import Post, Series, PostLikes, TempPosts, UsernameChangeLog
from board.services.post_service import PostService, PostValidationError


def post_detail(request, username, post_url):
    """
    View for the post detail page.
    """
    # Check if this is an old username in the change log
    username_log = UsernameChangeLog.objects.filter(username=username).select_related('user', 'user__profile').first()
    if username_log:
        # Check if the user is an editor
        if username_log.user.profile.is_editor():
            # This is an old username and user is an editor, redirect to the current username
            return redirect('post_detail', username=username_log.user.username, post_url=post_url)

    author = get_object_or_404(User, username=username)

    # Get the post
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
    
    # Check if the post is hidden and if the user has permission to view it
    if post.config.hide and (not request.user.is_authenticated or request.user != author):
        raise Http404("Post does not exist")

    # Format date for display
    post.created_date_display = post.created_date.strftime('%Y-%m-%d')
    
    # Initialize series attributes to avoid AttributeError
    post.series_total = 0
    post.visible_series_posts = []
    post.prev_post = None
    post.next_post = None

    if post.series:
        series_posts = list(Post.objects.filter(
            series=post.series,
            config__hide=False,
        ).order_by('created_date'))
        
        post.series_total = len(series_posts)

        for i, series_post in enumerate(series_posts):
            series_post.series_index = i + 1
            if series_post.id == post.id:
                post.series_index = i + 1
        
        # Prepare visible series posts for the template (max 5 posts)
        visible_posts = []
        current_idx = post.series_index - 1  # Convert to 0-based index
        
        # Determine which posts to show based on current position
        if post.series_total <= 5:
            # If 5 or fewer posts, show all
            visible_posts = series_posts
        elif post.series_index <= 3:
            # If near the beginning, show first 5
            visible_posts = series_posts[:5]
        elif post.series_index >= post.series_total - 2:
            # If near the end, show last 5
            visible_posts = series_posts[-5:]
        else:
            # Show 2 before and 2 after current post
            start = max(0, current_idx - 2)
            end = min(post.series_total, current_idx + 3)
            visible_posts = series_posts[start:end]

        post.prev_post = series_posts[current_idx - 1] if current_idx > 0 else None
        post.next_post = series_posts[current_idx + 1] if current_idx < post.series_total - 1 else None
        post.visible_series_posts = visible_posts
    
    
    context = {
        'post': post,
    }
    
    return render(request, 'board/posts/post_detail.html', context)


def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    # Check if user is authenticated
    if not request.user.is_authenticated:
        return redirect('login')
    
    # Check if user has editor role (for creating/editing posts)
    if not request.user.profile.is_editor():
        messages.error(request, '편집자 권한이 필요합니다. 관리자에게 문의하세요.')
        return redirect('index')

    is_edit = username is not None and post_url is not None
    post = None
    temp_post = None
    series_list = []
    
    # Check for temp post token
    temp_token = request.GET.get('temp_token') or request.GET.get('tempToken')
    if temp_token and not is_edit:
        try:
            temp_post = TempPosts.objects.get(token=temp_token, author=request.user)
        except TempPosts.DoesNotExist:
            pass
    
    # If editing an existing post
    if is_edit:
        author = get_object_or_404(User, username=username)
        
        # Check if the current user is the author
        if request.user != author:
            raise Http404("You don't have permission to edit this post")
        
        # Get the post
        try:
            post = Post.objects.select_related('config', 'series', 'content').get(
                author=author,
                url=post_url,
            )
        except Post.DoesNotExist:
            raise Http404("Post does not exist")
    
    # Get all series by the current user
    series_list = Series.objects.filter(owner=request.user).order_by('-updated_date')
    
    # Handle form submission
    if request.method == 'POST':
        # Check if delete action is requested
        if is_edit and request.POST.get('delete') == 'true':
            PostService.delete_post(post)
            messages.success(request, 'Post has been deleted successfully.')
            return redirect('user_profile', username=request.user.username)
        
        # Get form data
        title = request.POST.get('title')
        url = request.POST.get('url')
        text_html = request.POST.get('text_md')  # Now receiving HTML directly from editor
        text_md = text_html  # Keep text_md for backward compatibility, but it's now HTML
        meta_description = request.POST.get('meta_description', '')
        tags_str = request.POST.get('tag', '')
        series_id = request.POST.get('series', '')
        
        # Process tags
        tags = []
        if tags_str:
            tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
        
        # Process config options
        hide = request.POST.get('hide') in ['on', 'true']
        notice = request.POST.get('notice') in ['on', 'true']
        advertise = request.POST.get('advertise') in ['on', 'true']
        is_draft = request.POST.get('is_draft') == 'true'
        
        # Process series
        series = None
        if series_id:
            try:
                series = Series.objects.get(id=series_id, owner=request.user)
            except Series.DoesNotExist:
                pass
        
        # Create or update post
        if is_edit:
            # Handle image upload
            image = None
            if 'image' in request.FILES:
                image = request.FILES['image']
            elif request.POST.get('remove_image') == 'true':
                image = None  # This will be handled separately

            # Update existing post using service
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

            # Handle image removal separately if needed
            if request.POST.get('remove_image') == 'true':
                post.image = None
                post.save()

            messages.success(request, 'Post has been updated successfully.')
        else:
            # Handle image upload
            image = request.FILES.get('image', None)

            # Get temp post token if exists
            temp_token = request.POST.get('token', '')

            # Create new post using service
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
        
        # If it's a draft, redirect to edit mode
        if is_draft:
            messages.success(request, '게시글이 임시저장되었습니다.')
            return redirect('post_edit', username=request.user.username, post_url=post.url)

        # Redirect to the post detail page
        return redirect('post_detail', username=request.user.username, post_url=post.url)
    
    context = {
        'is_edit': is_edit,
        'post': post,
        'temp_post': temp_post,
        'series_list': series_list,
        'is_editor_page': True,
    }
    
    return render(request, 'board/posts/post_editor.html', context)
