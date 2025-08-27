from django import template
from django.conf import settings
from django.templatetags.static import static

register = template.Library()

@register.simple_tag
def resource(path):
    """Generate URL for service resource files"""
    return settings.RESOURCE_URL + path

@register.simple_tag  
def media(path):
    """Generate URL for user uploaded media files"""
    if not path:
        return ''
    return settings.MEDIA_URL + path

# Alias for Django's static tag to maintain consistency
@register.simple_tag
def static_file(path):
    """Generate URL for Django static files"""
    return static(path)
