from modules.markdown import parse_post_to_html

from board.modules.read_time import calc_read_time


class PostContentService:
    @staticmethod
    def normalize_content_html(html: str) -> str:
        return html or ''

    @staticmethod
    def html_input_to_content_html(html: str) -> str:
        return PostContentService.normalize_content_html(html)

    @staticmethod
    def markdown_input_to_content_html(markdown_text: str) -> str:
        return PostContentService.normalize_content_html(
            parse_post_to_html(markdown_text or '')
        )

    @staticmethod
    def input_to_content_html(content: str, content_type: str | None = None) -> str:
        if content_type == 'markdown':
            return PostContentService.markdown_input_to_content_html(content)
        return PostContentService.html_input_to_content_html(content)

    @staticmethod
    def sync_parent_read_time(post, content_html: str) -> None:
        post.read_time = calc_read_time(content_html)
        post.save()

    @staticmethod
    def create_for_post(post, content_html: str):
        from board.models import PostContent

        PostContentService.sync_parent_read_time(post, content_html)
        post_content = PostContent(post=post, content_html=content_html)
        post_content._skip_read_time_sync = True
        try:
            post_content.save()
        finally:
            delattr(post_content, '_skip_read_time_sync')
        return post_content

    @staticmethod
    def update_content(post_content, content_html: str):
        PostContentService.sync_parent_read_time(post_content.post, content_html)
        post_content.content_html = content_html
        post_content._skip_read_time_sync = True
        try:
            post_content.save()
        finally:
            delattr(post_content, '_skip_read_time_sync')
        return post_content
