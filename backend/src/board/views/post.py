import json
from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.http import Http404
from django.contrib import messages
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET

from board.models import Post, Series, PostLikes, UsernameChangeLog
from board.modules.response import StatusDone, StatusError
from board.services.post_service import PostService, PostValidationError
from board.services.post_trash_service import PostTrashService
from board.services.post_detail_render_service import PostDetailRenderService
from board.services.public_post_service import PublicPostService
from board.decorators import editor_required


def post_detail(request, username, post_url):
    """
    View for the post detail page.
    """
    # Check if this is an old username in the change log
    username_log = UsernameChangeLog.objects.filter(username=username).select_related('user').first()
    if username_log:
        if PublicPostService.filter_public_posts(Post.objects).filter(
            author=username_log.user,
            url=post_url,
        ).exists():
            return redirect('post_detail', username=username_log.user.username, post_url=post_url)

    author = get_object_or_404(User, username=username)

    try:
        post = PostService.get_post_detail(username, post_url, request.user)
    except Http404:
        raise Http404("Post does not exist")

    is_owner = request.user.is_authenticated and request.user == author
    if not PublicPostService.is_public(post) and (
        not is_owner or post.published_date is None
    ):
        raise Http404("Post does not exist")

    return PostDetailRenderService.render(request, post, author)


@require_GET
@xframe_options_sameorigin
def post_preview(request, post_url):
    if not request.user.is_authenticated:
        raise Http404("Post does not exist")

    try:
        post = PostService.get_post_detail(
            request.user.username,
            post_url,
            request.user,
        )
    except Http404:
        raise Http404("Post does not exist")

    if not post.is_draft():
        raise Http404("Post does not exist")

    return PostDetailRenderService.render(
        request,
        post,
        post.author,
        is_post_preview=True,
    )


@editor_required
def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    is_edit = username is not None and post_url is not None
    is_async_edit_submit = (
        is_edit
        and request.headers.get('X-BLEX-Editor-Submit') == 'async'
    )
    post = None
    draft_post = None
    series_list = []
    has_published_posts = Post.objects.filter(
        author=request.user,
        published_date__isnull=False,
    ).exists()
    show_first_publish_guide = not is_edit and not has_published_posts

    draft_url = request.GET.get('draft')
    if draft_url and not is_edit:
        try:
            draft_post = Post.objects.select_related('content').get(
                url=draft_url,
                author=request.user,
                published_date__isnull=True,
            )
        except Post.DoesNotExist:
            pass

    if is_edit:
        author = get_object_or_404(User, username=username)

        if request.user != author:
            raise Http404("You don't have permission to edit this post")

        try:
            post = PostService.get_post_detail(username, post_url, request.user)
        except Http404:
             raise Http404("Post does not exist")

    series_list = Series.objects.filter(owner=request.user).order_by('-updated_date')

    if request.method == 'POST':
        if is_edit and request.POST.get('delete') == 'true':
            PostTrashService.trash_post(post)
            messages.success(request, '포스트를 휴지통으로 옮겼습니다.')
            return redirect('user_profile', username=request.user.username)

        title = request.POST.get('title')
        subtitle = request.POST.get('subtitle', '')
        url = request.POST.get('url')
        text_html = (
            request.POST.get('content_html')
            or request.POST.get('text_html')
            or request.POST.get('text_md')
            or ''
        )
        content_type = request.POST.get('content_type', 'html')
        meta_description = request.POST.get('meta_description', '')
        tags_str = request.POST.get('tag', '')
        series_id = request.POST.get('series', '')

        tags = []
        if tags_str:
            tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]

        hide = request.POST.get('hide') in ['on', 'true']
        advertise = request.POST.get('advertise') in ['on', 'true']
        block_comment_value = request.POST.get('block_comment')
        block_comment = (
            block_comment_value in ['on', 'true']
            if block_comment_value is not None
            else None
        )
        is_draft = request.POST.get('is_draft') == 'true'
        image_delete = request.POST.get('image_delete') == 'true' or request.POST.get('remove_image') == 'true'
        cover_layout = request.POST.get('cover_layout')
        cover_image_position = request.POST.get('cover_image_position')
        cover_image_ratio = request.POST.get('cover_image_ratio')
        reserved_date = request.POST.get('reserved_date', '')

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
            elif image_delete:
                image = None

            try:
                PostService.update_post(
                    post=post,
                    title=title,
                    subtitle=subtitle,
                    text_html=text_html,
                    description=meta_description,
                    series_url=series.url if series else None,
                    tag=','.join(tags) if tags else None,
                    image=image,
                    image_delete=image_delete,
                    is_hide=hide,
                    is_advertise=advertise,
                    block_comment=block_comment,
                    content_type=content_type,
                    cover_layout=cover_layout,
                    cover_image_position=cover_image_position,
                    cover_image_ratio=cover_image_ratio,
                    reserved_date_str=request.POST.get('reserved_date'),
                )
            except PostValidationError as e:
                if is_async_edit_submit:
                    return StatusError(e.code, e.message)
                messages.error(request, e.message)
                return redirect('post_edit', username=request.user.username, post_url=post.url)

            messages.success(request, 'Post has been updated successfully.')
        else:
            image = request.FILES.get('image', None)

            # Check if publishing from a draft
            post_draft_url = request.POST.get('draft_url', '')

            if post_draft_url:
                # Publishing an existing draft
                try:
                    existing_draft = Post.objects.select_related('content', 'config').get(
                        url=post_draft_url,
                        author=request.user,
                        published_date__isnull=True,
                    )
                    post = PostService.publish_draft(
                        post=existing_draft,
                        title=title,
                        subtitle=subtitle,
                        text_html=text_html,
                        description=meta_description,
                        series_url=series.url if series else '',
                        custom_url=url,
                        tag=','.join(tags) if tags else '',
                        image=image,
                        image_delete=image_delete,
                        is_hide=hide,
                        is_advertise=advertise,
                        block_comment=block_comment,
                        content_type=content_type,
                        cover_layout=cover_layout,
                        cover_image_position=cover_image_position,
                        cover_image_ratio=cover_image_ratio,
                        reserved_date_str=reserved_date,
                    )
                    messages.success(request, 'Post has been published successfully.')
                except Post.DoesNotExist:
                    # Draft doesn't exist, create as normal post
                    post_draft_url = ''
                except PostValidationError as e:
                    messages.error(request, e.message)
                    return redirect(f"{reverse('post_write')}?draft={post_draft_url}")

            if not post_draft_url:
                try:
                    post, post_content, post_config = PostService.create_post(
                        user=request.user,
                        title=title,
                        text_html=text_html,
                        subtitle=subtitle,
                        description=meta_description,
                        series_url=series.url if series else '',
                        custom_url=url,
                        tag=','.join(tags) if tags else '',
                        image=image,
                        is_hide=hide,
                        is_advertise=advertise,
                        block_comment=block_comment if block_comment is not None else False,
                        content_type=content_type,
                        cover_layout=cover_layout,
                        cover_image_position=cover_image_position,
                        cover_image_ratio=cover_image_ratio,
                        reserved_date_str=reserved_date,
                    )
                    messages.success(request, 'Post has been created successfully.')
                except PostValidationError as e:
                    messages.error(request, e.message)
                    return redirect('post_write')

        if is_draft:
            messages.success(request, '포스트가 임시저장되었습니다.')
            return redirect('post_edit', username=request.user.username, post_url=post.url)

        post_detail_url = reverse('post_detail', kwargs={
            'username': request.user.username,
            'post_url': post.url,
        })
        if is_async_edit_submit:
            return StatusDone({'url': post_detail_url})
        return redirect(post_detail_url)

    context = {
        'is_edit': is_edit,
        'post': post,
        'draft_post': draft_post,
        'series_list': series_list,
        'is_editor_page': True,
        'show_first_publish_guide': show_first_publish_guide,
    }

    return render(request, 'board/posts/post_editor.html', context)
