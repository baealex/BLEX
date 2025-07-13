from django import template

register = template.Library()

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
