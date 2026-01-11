from bs4 import BeautifulSoup
from django.utils.text import slugify

def generate_toc(html_content):
    """
    Parses HTML content to extract headers (h1-h6) for a Table of Contents.
    Adds unique IDs to headers if they don't have one.
    
    Args:
        html_content (str): The HTML content of the post.
        
    Returns:
        tuple: (modified_html, toc_list)
        where toc_list is a list of dicts: {'level': int, 'text': str, 'id': str}
    """
    if not html_content:
        return html_content, []

    soup = BeautifulSoup(html_content, 'html.parser')
    toc = []
    headers = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    
    existing_ids = set()
    
    # First pass: collect existing IDs to avoid collisions
    for header in headers:
        if header.get('id'):
            existing_ids.add(header['id'])
            
    for header in headers:
        header_text = header.get_text().strip()
        if not header_text:
            continue
            
        header_id = header.get('id')
        
        if not header_id:
            base_id = slugify(header_text, allow_unicode=True) or 'section'
            header_id = base_id
            counter = 1
            while header_id in existing_ids:
                header_id = f"{base_id}-{counter}"
                counter += 1
            existing_ids.add(header_id)
            header['id'] = header_id
        
        toc.append({
            'level': int(header.name[1]),
            'text': header_text,
            'id': header_id
        })
        
    return str(soup), toc
