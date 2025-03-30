from django.utils.html import strip_tags
from django.template.defaultfilters import truncatewords

def create_post_description(post_content_html: str) -> str:
    post_content = strip_tags(post_content_html)
    return truncatewords(post_content, 50)
