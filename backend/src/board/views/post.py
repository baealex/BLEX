from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.utils import timezone
from django.http import Http404
from django.utils.text import slugify
from django.contrib import messages

from board.models import Post, Series, PostLikes, PostConfig, PostContent, Invitation
from modules import markdown


def generate_unique_url(title, author, exclude_id=None):
    """
    Generate a unique URL for a post by the given author.
    If the base URL already exists, append a number suffix.
    """
    base_url = slugify(title)
    if not base_url:
        base_url = 'untitled'
    
    url = base_url
    counter = 1
    
    while True:
        # Check if URL already exists for this author
        query = Post.objects.filter(author=author, url=url)
        if exclude_id:
            query = query.exclude(id=exclude_id)
        
        if not query.exists():
            return url
        
        # If exists, try with counter suffix
        url = f"{base_url}-{counter}"
        counter += 1


def post_detail(request, username, post_url):
    """
    View for the post detail page.
    """
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
    
    # Calculate read time (approximately 200 words per minute)
    word_count = len(post.content.text_html.strip().split())
    post.read_time = max(1, round(word_count / 200))
    
    # Format date
    post.created_date = post.created_date.strftime('%Y-%m-%d')
    
    # Initialize series attributes to avoid AttributeError
    post.series_total = 0
    post.visible_series_posts = []
    post.prev_post = None
    post.next_post = None
    
    # Get series posts if the post is part of a series
    if post.series:
        series_posts = list(Post.objects.filter(
            series=post.series,
            config__hide=False,
        ).order_by('created_date'))
        
        post.series_total = len(series_posts)
        
        # Add series_index to each post in the series
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
        
        # Get previous and next posts if they exist
        post.prev_post = series_posts[current_idx - 1] if current_idx > 0 else None
        post.next_post = series_posts[current_idx + 1] if current_idx < post.series_total - 1 else None
        post.visible_series_posts = visible_posts
    
    # Get related posts (posts with similar tags)
    related_posts = []
    # if post.tags:
    #     related_posts = Post.objects.select_related(
    #         'author', 'author__profile'
    #     ).filter(
    #         tags__overlap=post.tags,
    #         config__hide=False,
    #     ).exclude(
    #         id=post.id
    #     ).annotate(
    #         author_username=F('author__username'),
    #         author_image=F('author__profile__avatar'),
    #         count_likes=Count('likes', distinct=True),
    #         count_comments=Count('comments', distinct=True),
    #     ).order_by('-created_date')[:3]
    #     
    #     # Format dates and calculate read time for related posts
    #     for related_post in related_posts:
    #         related_post.created_date = related_post.created_date.strftime('%Y-%m-%d')
    #         word_count = len(related_post.content.split())
    #         related_post.read_time = max(1, round(word_count / 200))
    
    context = {
        'post': post,
        'related_posts': related_posts,
    }
    
    return render(request, 'board/post_detail.html', context)


def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    # Check if user is authenticated
    if not request.user.is_authenticated:
        return redirect('login')
    
    # Check if user has invitation (for new posts)
    is_edit = username is not None and post_url is not None
    if not is_edit:
        has_invitation = Invitation.objects.filter(receiver=request.user).exists()
        if not has_invitation:
            return render(request, 'board/invitation_required.html')
    post = None
    series_list = []
    
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
            post.delete()
            messages.success(request, 'Post has been deleted successfully.')
            return redirect('user_profile', username=request.user.username)
        
        # Get form data
        title = request.POST.get('title')
        url = request.POST.get('url')
        text_md = request.POST.get('text_md')
        text_html = markdown.parse_to_html(text_md)
        meta_description = request.POST.get('meta_description', '')
        tags_str = request.POST.get('tags', '')
        series_id = request.POST.get('series', '')
        
        # Process tags
        tags = []
        if tags_str:
            tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
        
        # Process config options
        hide = request.POST.get('hide') == 'on'
        notice = request.POST.get('notice') == 'on'
        advertise = request.POST.get('advertise') == 'on'
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
            # Update existing post
            post.title = title
            # Don't update URL when editing to maintain SEO and avoid breaking links
            # post.url = url  
            post.meta_description = meta_description
            post.series = series
            post.updated_date = timezone.now()
            
            # Handle image upload
            if 'image' in request.FILES:
                post.image = request.FILES['image']
            elif request.POST.get('remove_image') == 'true':
                post.image = None
            
            post.save()
            
            # Update post content
            post.content.text_md = text_md
            post.content.text_html = text_html
            post.content.save()
            
            # Update post config
            post.config.hide = hide
            post.config.notice = notice
            post.config.advertise = advertise
            post.config.save()
            
            # Process tags
            if tags:
                post.set_tags(','.join(tags))
            
            messages.success(request, 'Post has been updated successfully.')
        else:
            # Generate unique URL for new post
            unique_url = url or generate_unique_url(title, request.user)
            
            # Create the post first
            post = Post.objects.create(
                title=title,
                url=unique_url,
                meta_description=meta_description,
                author=request.user,
                series=series
            )
            
            # Handle image upload
            if 'image' in request.FILES:
                post.image = request.FILES['image']
                post.save()
            
            # Now create the related models
            PostConfig.objects.create(
                post=post,
                hide=hide,
                notice=notice,
                advertise=advertise
            )
            
            PostContent.objects.create(
                post=post,
                text_md=text_md,
                text_html=text_html
            )
            
            # Process tags
            if tags:
                post.set_tags(','.join(tags))
            
            messages.success(request, 'Post has been created successfully.')
        
        # If it's a draft and this is a new post, redirect to edit mode
        if is_draft and not is_edit:
            messages.success(request, '게시글이 임시저장되었습니다.')
            return redirect('post_editor', username=request.user.username, post_url=post.url)
        elif is_draft and is_edit:
            messages.success(request, '게시글이 임시저장되었습니다.')
            return redirect('post_editor', username=request.user.username, post_url=post.url)
        
        # Redirect to the post detail page
        return redirect('post_detail', username=request.user.username, post_url=post.url)
    
    context = {
        'is_edit': is_edit,
        'post': post,
        'series_list': series_list,
    }
    
    return render(request, 'board/post_editor.html', context)
