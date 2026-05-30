import json
from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.contrib.auth.models import User
from django.db.models import Count, F, Exists, OuterRef
from django.http import Http404
from django.contrib import messages
from django.conf import settings
from django.utils import timezone

from board.models import Post, Series, PostLikes, UsernameChangeLog
from board.services.post_service import PostService, PostValidationError
from board.services.banner_service import BannerService
from board.services.agent_content_service import AgentContentService
from board.services.discovery_metadata_service import DiscoveryMetadataService
from board.services.public_post_service import PublicPostService
from board.services.site_url_service import SiteUrlService
from board.html_utils import extract_table_of_contents
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

    post.created_date_display = timezone.localtime(post.published_date).strftime('%Y-%m-%d')
    post.updated_date_display = timezone.localtime(post.updated_date).strftime('%Y-%m-%d')
    show_post_updated_date = post.created_date_display != post.updated_date_display

    author_profile = getattr(author, 'profile', None)
    author_bio = author_profile.bio.strip() if author_profile and author_profile.bio else ''
    author_homepage = author_profile.homepage.strip() if author_profile and author_profile.homepage else ''

    # Initialize series attributes to avoid AttributeError
    post.series_total = 0
    post.visible_series_posts = []
    post.prev_post = None
    post.next_post = None

    if post.series:
        post.visible_series_posts = PostService.get_visible_series_posts(post)

    # Extract table of contents from post content
    content_html_with_ids, table_of_contents = extract_table_of_contents(post.content.content_html)

    banners = BannerService.get_all_banners_for_author(author)

    post_absolute_url = post.get_absolute_url()
    canonical_url = SiteUrlService.absolute_url(request, post_absolute_url)
    author_url = SiteUrlService.absolute_url(request, reverse('user_profile', args=[author.username]))
    post_image_url = SiteUrlService.absolute_url(request, post.image.url) if post.image else ''
    logo_url = SiteUrlService.absolute_url(request, f'{settings.RESOURCE_URL}logo.png')

    aeo_enabled = AgentContentService.is_aeo_enabled()
    is_public_post = PublicPostService.is_public(post)
    post_visibility_status = 'public'
    if post.config.hide:
        post_visibility_status = 'hidden'
    elif not is_public_post:
        post_visibility_status = 'scheduled'

    show_post_status_notice = (
        is_owner
        and post_visibility_status in {'hidden', 'scheduled'}
    )
    can_edit_post = PostService.can_user_edit_post(request.user, post)

    show_agent_post_markdown = aeo_enabled and is_public_post
    context = {
        'post': post,
        'banners': banners,
        'content_html': content_html_with_ids,
        'table_of_contents': table_of_contents,
        'aeo_enabled': aeo_enabled,
        'canonical_url': canonical_url,
        'author_url': author_url,
        'post_image_url': post_image_url,
        'logo_url': logo_url,
        'show_post_status_notice': show_post_status_notice,
        'can_edit_post': can_edit_post,
        'post_visibility_status': post_visibility_status,
        'show_agent_post_markdown': show_agent_post_markdown,
        'show_post_updated_date': show_post_updated_date,
        'author_bio': author_bio,
        'author_homepage': author_homepage,
        **DiscoveryMetadataService.build_user_rss_feed_metadata(author, request),
    }
    if show_agent_post_markdown:
        context['post_markdown_url'] = AgentContentService.build_post_markdown_url(post, request)

    response = render(request, 'board/posts/post_detail.html', context)
    if show_agent_post_markdown:
        response['Link'] = AgentContentService.build_agent_link_header(post, request)
        response['X-Llms-Txt'] = AgentContentService.build_llms_txt_url(request)
    return response


@editor_required
def post_editor(request, username=None, post_url=None):
    """
    View for the post editor page.
    Used for both creating new posts and editing existing posts.
    """
    is_edit = username is not None and post_url is not None
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
            PostService.delete_post(post)
            messages.success(request, 'Post has been deleted successfully.')
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
        is_draft = request.POST.get('is_draft') == 'true'
        image_delete = request.POST.get('image_delete') == 'true' or request.POST.get('remove_image') == 'true'

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
                content_type=content_type,
            )

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
                        content_type=content_type,
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
                        content_type=content_type,
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
