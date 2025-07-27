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
    
    # Calculate start and end page numbers to show
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
    
    # Get the current query parameters
    query_dict = request.GET.copy()
    
    # Update or add the page parameter
    query_dict['page'] = page_number
    
    # Return the URL with updated query parameters
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
    
    # Get the current query parameters
    query_dict = request.GET.copy()
    
    # Remove the page parameter if it exists
    if 'page' in query_dict:
        query_dict.pop('page')
    
    # Return the base URL with preserved query parameters
    if query_dict:
        return f"?{query_dict.urlencode()}&page="
    else:
        return "?page="
