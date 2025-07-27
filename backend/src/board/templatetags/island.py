from django import template
from django.utils.safestring import mark_safe
from django.templatetags.static import static
from django.conf import settings
import json
import logging
import urllib.parse
import os

logger = logging.getLogger('board')
register = template.Library()

# Path to the Vite manifest file
_manifest_cache = None

def get_manifest():
    """
    Load the Vite manifest file and cache it.
    """
    global _manifest_cache

    if settings.DEBUG:
        _manifest_cache = None
    
    if _manifest_cache is None:
        # Try multiple possible locations for the manifest file
        possible_paths = [
            # Production path (using STATIC_ROOT)
            os.path.join(settings.STATIC_ROOT, 'islands', 'manifest.json') if hasattr(settings, 'STATIC_ROOT') else None,
        ]
        
        for path in possible_paths:
            if path and os.path.exists(path):
                try:
                    with open(path, 'r') as f:
                        _manifest_cache = json.load(f)
                        logger.info(f"Loaded Vite manifest from {path}")
                        break
                except (json.JSONDecodeError):
                    logger.warning(f"Failed to parse manifest file at {path}")
        
        # If no manifest file was found or loaded successfully
        if _manifest_cache is None:
            logger.warning("No Vite manifest file found, using empty cache")
            _manifest_cache = {}

    return _manifest_cache

@register.simple_tag
def island_entry(entry_name):
    """
    Get the hashed filename for a Vite entry point.
    
    Usage:
    {% load island %}
    <script type="module" src="{% island_entry 'island' %}"></script>
    """
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    entry_ext = [".js", ".jsx", ".ts", ".tsx"]
    
    # Look for the entry in the manifest
    for key, value in manifest.items():
        for ext in entry_ext:
            if entry_path in key and key.endswith(ext):
                return static(f"islands/{value['file']}")
    
    # If not found in manifest (e.g., in development), return the default path
    return static(f"islands/{entry_name}")

@register.simple_tag
def island_css(entry_name):
    """
    Get the hashed filename for a Vite CSS entry point.
    
    Usage:
    {% load island %}
    <link rel="stylesheet" href="{% island_css 'main' %}">
    """
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    entry_ext = [".css", ".scss", ".sass"]
    
    # Look for the CSS entry in the manifest
    for key, value in manifest.items():
        for ext in entry_ext:
            if entry_path in key and key.endswith(ext):
                return static(f"islands/{value['file']}")
    
    # If not found in manifest (e.g., in development), return the default path
    return static(f"islands/{entry_name}")

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
