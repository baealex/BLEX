from django import template
from django.utils.safestring import mark_safe
import json
import logging

logger = logging.getLogger('board')
register = template.Library()

@register.simple_tag
def react_component(component_name, **props):
    """
    템플릿에서 React 컴포넌트를 렌더링하기 위한 템플릿 태그
    
    사용법:
    {% load react_tags %}
    {% react_component 'LikeButton' post_id=post.id likes_count=post.count_likes has_liked=post.has_liked %}
    """
    logger.error(f"react_component called with: {component_name}, {props}")
    
    # JSON 직렬화 시 오류가 발생할 수 있는 객체 처리
    for key, value in props.items():
        if hasattr(value, 'isoformat'):
            props[key] = value.isoformat()
    
    props_json = json.dumps(props)
    html_output = f'<div data-react-component="{component_name}" data-props="{props_json}"></div>'
    logger.error(f"react_component output: {html_output}")
    
    return mark_safe(html_output)
