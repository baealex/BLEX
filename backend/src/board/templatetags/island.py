from django import template
from django.utils.safestring import mark_safe
import json
import logging
import urllib.parse

logger = logging.getLogger('board')
register = template.Library()

@register.simple_tag
def island_component(component_name, **props):
    """
    템플릿에서 React 컴포넌트를 렌더링하기 위한 템플릿 태그
    
    사용법:
    {% load island %}
    {% island_component 'LikeButton' post_id=post.id likes_count=post.count_likes has_liked=post.has_liked %}
    """
    
    for key, value in props.items():
        if hasattr(value, 'isoformat'):
            props[key] = value.isoformat()
    
    props_json = json.dumps(props)
    html_output = f'<island-component name="{component_name}" props="{urllib.parse.quote(props_json)}"></island-component>'
    
    return mark_safe(html_output)
