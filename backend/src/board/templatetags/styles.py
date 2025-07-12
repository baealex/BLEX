from django import template
from django.utils.safestring import mark_safe
import logging
import os
from pathlib import Path

logger = logging.getLogger('board')
register = template.Library()

@register.simple_tag
def include_style(context):
    """
    템플릿에서 스타일 패키지를 포함하기 위한 템플릿 태그
    
    사용법:
    {% load styles %}
    {% include_style 'author' %}
    """
    logger.info(f"include_style called with: {context}")
    
    # Define the base path for style packages
    base_dir = Path(__file__).resolve().parent.parent.parent
    style_package_path = base_dir / 'static' / 'assets' / 'styles'

    # Get style file with context included
    styles_files = os.listdir(style_package_path)
    style_file = [f for f in styles_files if context in f]
    if not style_file:
        logger.warning(f"Style file not found: {context}")
        return ""
    
    # Generate a link tag to include the style
    html_output = f'<link rel="stylesheet" href="/static/assets/styles/{style_file[0]}">'
    logger.info(f"include_style output: {html_output}")
    
    return mark_safe(html_output)
