from django.contrib.auth.models import User
from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone
from django.utils.cache import patch_vary_headers

from board.html_utils import extract_table_of_contents
from board.models import Post
from board.services.agent_content_service import AgentContentService
from board.services.banner_service import BannerService
from board.services.brand_asset_service import BrandAssetService
from board.services.discovery_metadata_service import DiscoveryMetadataService
from board.services.post_service import PostService
from board.services.public_post_service import PublicPostService
from board.services.site_url_service import SiteUrlService


class PostDetailRenderService:
    @staticmethod
    def build_context(
        request: HttpRequest,
        post: Post,
        author: User,
        *,
        is_post_preview: bool = False,
    ) -> dict[str, object]:
        preview_date = post.published_date or post.updated_date or post.created_date
        post.preview_date = preview_date
        post.created_date_display = timezone.localtime(preview_date).strftime('%Y-%m-%d')
        post.updated_date_display = timezone.localtime(post.updated_date).strftime('%Y-%m-%d')
        show_post_updated_date = post.created_date_display != post.updated_date_display

        author_profile = getattr(author, 'profile', None)
        author_bio = author_profile.bio.strip() if author_profile and author_profile.bio else ''
        author_homepage = author_profile.homepage.strip() if author_profile and author_profile.homepage else ''

        post.series_total = 0
        post.visible_series_posts = []
        post.prev_post = None
        post.next_post = None

        if post.series and not is_post_preview:
            post.visible_series_posts = PostService.get_visible_series_posts(post)

        content_html_with_ids, table_of_contents = extract_table_of_contents(
            post.content.content_html,
        )
        banners = BannerService.get_all_banners_for_author(author)

        canonical_url = ''
        if not is_post_preview:
            canonical_url = SiteUrlService.absolute_url(
                request,
                post.get_absolute_url(),
            )
        author_url = SiteUrlService.absolute_url(
            request,
            reverse('user_profile', args=[author.username]),
        )
        post_image_url = (
            SiteUrlService.absolute_url(request, post.image.url)
            if post.image
            else ''
        )
        logo_url = BrandAssetService.absolute_icon_png_url(request, None, 512)

        aeo_enabled = AgentContentService.is_aeo_enabled()
        is_public_post = PublicPostService.is_public(post)
        post_visibility_status = 'draft' if is_post_preview else 'public'
        if not is_post_preview and post.config.hide:
            post_visibility_status = 'hidden'
        elif not is_post_preview and not is_public_post:
            post_visibility_status = 'scheduled'

        show_post_status_notice = (
            is_post_preview
            or (
                request.user.is_authenticated
                and request.user == author
                and post_visibility_status in {'hidden', 'scheduled'}
            )
        )
        can_edit_post = (
            not is_post_preview
            and PostService.can_user_edit_post(request.user, post)
        )
        show_agent_post_markdown = (
            not is_post_preview
            and aeo_enabled
            and is_public_post
        )

        post_cover_layout = post.config.cover_layout
        if post_cover_layout not in {'default', 'split', 'overlay', 'none'}:
            post_cover_layout = 'default'
        if not post.image and post_cover_layout in {'split', 'overlay'}:
            post_cover_layout = 'default'
        post_cover_is_full_bleed = post_cover_layout in {'split', 'overlay'}
        post_cover_template = f'board/posts/covers/{post_cover_layout}.html'

        context: dict[str, object] = {
            'post': post,
            'banners': banners,
            'content_html': content_html_with_ids,
            'table_of_contents': table_of_contents,
            'post_cover_layout': post_cover_layout,
            'post_cover_is_full_bleed': post_cover_is_full_bleed,
            'post_cover_template': post_cover_template,
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
            'is_post_preview': is_post_preview,
        }
        if not is_post_preview:
            context.update(
                DiscoveryMetadataService.build_user_rss_feed_metadata(
                    author,
                    request,
                ),
            )
        if show_agent_post_markdown:
            context['post_markdown_url'] = (
                AgentContentService.build_post_markdown_url(post, request)
            )

        return context

    @staticmethod
    def render(
        request: HttpRequest,
        post: Post,
        author: User,
        *,
        is_post_preview: bool = False,
    ) -> HttpResponse:
        context = PostDetailRenderService.build_context(
            request,
            post,
            author,
            is_post_preview=is_post_preview,
        )
        response = render(request, 'board/posts/post_detail.html', context)

        if is_post_preview:
            response['Cache-Control'] = 'private, no-store'
            response['Pragma'] = 'no-cache'
            response['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
            patch_vary_headers(response, ('Cookie',))
        elif context['show_agent_post_markdown']:
            response['Link'] = AgentContentService.build_agent_link_header(
                post,
                request,
            )
            response['X-Llms-Txt'] = AgentContentService.build_llms_txt_url(
                request,
            )

        return response
