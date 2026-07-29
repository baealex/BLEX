from django import template

from board.html_utils import (
    safe_external_url as normalize_external_url,
    safe_navigation_url as normalize_navigation_url,
)


register = template.Library()


@register.filter
def safe_external_url(value):
    return normalize_external_url(value)


@register.filter
def safe_navigation_url(value):
    return normalize_navigation_url(value)
