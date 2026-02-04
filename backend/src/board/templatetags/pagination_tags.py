from django import template
from urllib.parse import urlencode

register = template.Library()

@register.filter
def range_filter(start, end):
    """
    Generate a range of numbers from start to end (inclusive).
    Usage: {% for i in start|range:end %}
    """
    start = int(start)
    end = int(end)
    return range(start, end + 1)

@register.filter
def get_page_range(total_pages, current_page):
    """
    Generate a range of page numbers to display in pagination.
    Shows current page, 2 pages before and after current page.
    """
    current_page = int(current_page)
    total_pages = int(total_pages)
    start_page = max(current_page - 2, 1)
    end_page = min(current_page + 2, total_pages)
    return range(start_page, end_page + 1)


@register.simple_tag(takes_context=True)
def get_pagination_url(context, page_number):
    """
    Generate a URL for pagination that preserves existing query parameters
    while updating or adding the page parameter.
    """
    request = context.get('request')
    if not request:
        return f"?page={page_number}"

    query_dict = request.GET.copy()
    query_dict['page'] = page_number
    return f"?{query_dict.urlencode()}"


@register.simple_tag(takes_context=True)
def get_pagination_base_url(context):
    """
    Generate a base URL for pagination that preserves existing query parameters
    without the page parameter.
    """
    request = context.get('request')
    if not request:
        return "?page="

    query_dict = request.GET.copy()
    query_dict.pop('page', None)

    if query_dict:
        return f"?{query_dict.urlencode()}&page="
    return "?page="
