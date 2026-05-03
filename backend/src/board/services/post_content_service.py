from modules.markdown import parse_post_to_html


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
