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

# Module-level cache for the Vite manifest
_manifest_cache = None

def get_manifest():
    """
    Load the Vite manifest file and cache it in memory.
    """
    global _manifest_cache
  
    if _manifest_cache is None:
        # Try multiple possible locations for the manifest file
        possible_paths = [
            # Production path (using STATIC_ROOT)
            os.path.join(settings.STATIC_ROOT, 'islands', '.vite', 'manifest.json') if hasattr(settings, 'STATIC_ROOT') else None,
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
    <script type="module" src="{% island_entry 'src/island.tsx' %}"></script>
    """
    # Check if in development mode
    if settings.DEBUG:
        return f"http://localhost:5173/{entry_name}"
    
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    
    # Look for the entry in the manifest
    for key, value in manifest.items():
        if entry_path in key:
            return static(f"islands/{value['file']}")
    
    # If not found in manifest (e.g., in development), return the default path
    return static(f"islands/{entry_name}")

@register.simple_tag
def island_css(entry_name):
    """
    Get the hashed filename for a Vite CSS entry point.
    
    Usage:
    {% load island %}
    <link rel="stylesheet" href="{% island_css 'styles/main.scss' %}">
    """
    # Check if in development mode
    if settings.DEBUG:
        return f"http://localhost:5173/{entry_name}"
    
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    
    # Look for the CSS entry in the manifest
    for key, value in manifest.items():
        if entry_path in key:
            return static(f"islands/{value['file']}")
    
    return static(f"islands/{entry_name}")

@register.simple_tag
def island_component(component_name, lazy=False, **props):
    """
    템플릿에서 React 컴포넌트를 렌더링하기 위한 템플릿 태그

    사용법:
    {% load island %}
    {% island_component 'LikeButton' post_id=post.id likes_count=post.count_likes has_liked=post.has_liked %}

    Lazy loading 사용법:
    {% island_component 'RelatedPosts' lazy=True postUrl=post.url username=post.author_username %}
    """

    for key, value in props.items():
        if hasattr(value, 'isoformat'):
            props[key] = value.isoformat()

    props_json = json.dumps(props)
    lazy_attr = ' lazy="true"' if lazy else ''
    html_output = f'<island-component name="{component_name}" props="{urllib.parse.quote(props_json)}"{lazy_attr}></island-component>'

    return mark_safe(html_output)

@register.simple_tag
def vite_hmr_client():
    """
    DEBUG 모드일 때만 Vite HMR 클라이언트를 로드
    """
    if settings.DEBUG:
        preamble = """
        <script type="module">
            import RefreshRuntime from 'http://localhost:5173/@react-refresh'
            RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {}
            window.$RefreshSig$ = () => (type) => type
            window.__vite_plugin_react_preamble_installed__ = true
        </script>
        """
        client = '<script type="module" src="http://localhost:5173/@vite/client"></script>'
        return mark_safe(preamble + client)
    return ""
