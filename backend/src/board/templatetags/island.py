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
LOOPBACK_DEV_SERVER_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', '::1'}


def format_netloc(hostname, port):
    if ':' in hostname and not hostname.startswith('['):
        hostname = f'[{hostname}]'
    return f'{hostname}:{port}' if port else hostname


def rewrite_vite_dev_server_host(url, request=None):
    if request is None:
        return url.rstrip('/')

    parsed_url = urllib.parse.urlsplit(url)
    vite_hostname = (parsed_url.hostname or '').lower()
    if vite_hostname not in LOOPBACK_DEV_SERVER_HOSTS:
        return url.rstrip('/')

    request_host = request.get_host()
    parsed_request_host = urllib.parse.urlsplit(f'//{request_host}')
    request_hostname = parsed_request_host.hostname
    if not request_hostname:
        return url.rstrip('/')

    return urllib.parse.urlunsplit((
        parsed_url.scheme,
        format_netloc(request_hostname, parsed_url.port),
        parsed_url.path,
        parsed_url.query,
        parsed_url.fragment,
    )).rstrip('/')


def get_vite_dev_server_url(request=None):
    """
    Resolve the Vite dev server URL from the runtime info file written by Vite.
    Falls back to settings.VITE_DEV_SERVER_URL before the dev server has started.
    """
    url = None
    info_path = getattr(settings, 'VITE_DEV_SERVER_INFO_PATH', None)
    if info_path and os.path.exists(info_path):
        try:
            with open(info_path, 'r') as f:
                info = json.load(f)
            info_url = info.get('url')
            if isinstance(info_url, str) and info_url:
                url = info_url
        except (OSError, json.JSONDecodeError):
            logger.warning("Failed to read Vite dev server info from %s", info_path)

    if not url:
        url = getattr(settings, 'VITE_DEV_SERVER_URL', 'http://localhost:8100')

    return rewrite_vite_dev_server_host(url, request)


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

def island_entry(entry_name, request=None):
    """
    Get the hashed filename for a Vite entry point.
    
    Usage:
    {% load island %}
    <script type="module" src="{% island_entry 'src/island.tsx' %}"></script>
    """
    # Check if in development mode
    if getattr(settings, 'USE_VITE_DEV_SERVER', settings.DEBUG):
        return f"{get_vite_dev_server_url(request)}/{entry_name}"
    
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    
    # Look for the entry in the manifest
    for key, value in manifest.items():
        if entry_path in key:
            return static(f"islands/{value['file']}")
    
    # If not found in manifest (e.g., in development), return the default path
    return static(f"islands/{entry_name}")

@register.simple_tag(takes_context=True, name='island_entry')
def island_entry_tag(context, entry_name):
    return island_entry(entry_name, context.get('request'))


def island_css(entry_name, request=None):
    """
    Get the hashed filename for a Vite CSS entry point.
    
    Usage:
    {% load island %}
    <link rel="stylesheet" href="{% island_css 'styles/main.scss' %}">
    """
    # Check if in development mode
    if getattr(settings, 'USE_VITE_DEV_SERVER', settings.DEBUG):
        return f"{get_vite_dev_server_url(request)}/{entry_name}"
    
    manifest = get_manifest()
    entry_path = f"{entry_name}"
    
    # Look for the CSS entry in the manifest
    for key, value in manifest.items():
        if entry_path in key:
            return static(f"islands/{value['file']}")
    
    return static(f"islands/{entry_name}")


@register.simple_tag(takes_context=True, name='island_css')
def island_css_tag(context, entry_name):
    return island_css(entry_name, context.get('request'))


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
    html_output = (
        f'<island-component '
        f'name="{component_name}" '
        f'data-island-name="{component_name}" '
        f'data-island-status="pending" '
        f'props="{urllib.parse.quote(props_json)}"{lazy_attr}></island-component>'
    )

    return mark_safe(html_output)

def vite_hmr_client(request=None):
    """
    DEBUG 모드일 때만 Vite HMR 클라이언트를 로드
    """
    if getattr(settings, 'USE_VITE_DEV_SERVER', settings.DEBUG):
        vite_url = get_vite_dev_server_url(request)
        preamble = f"""
        <script type="module">
            import RefreshRuntime from '{vite_url}/@react-refresh'
            RefreshRuntime.injectIntoGlobalHook(window)
            window.$RefreshReg$ = () => {{}}
            window.$RefreshSig$ = () => (type) => type
            window.__vite_plugin_react_preamble_installed__ = true
        </script>
        """
        client = f'<script type="module" src="{vite_url}/@vite/client"></script>'
        return mark_safe(preamble + client)
    return ""


@register.simple_tag(takes_context=True, name='vite_hmr_client')
def vite_hmr_client_tag(context):
    return vite_hmr_client(context.get('request'))
