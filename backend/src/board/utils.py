"""
Utility functions for the board app
"""
import re
from bs4 import BeautifulSoup


# Allowed HTML tags for banner content
ALLOWED_TAGS = [
    'div', 'p', 'span', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'br', 'strong', 'em', 'b', 'i', 'u', 'blockquote',
    'code', 'pre', 'hr', 'small', 'sub', 'sup', 'mark', 'del', 'ins'
]

# Allowed HTML attributes per tag
ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
    'div': ['class', 'id', 'style'],
    'span': ['class', 'id', 'style'],
    'p': ['class', 'id', 'style'],
    'h1': ['class', 'id'],
    'h2': ['class', 'id'],
    'h3': ['class', 'id'],
    'h4': ['class', 'id'],
    'h5': ['class', 'id'],
    'h6': ['class', 'id'],
    'code': ['class'],
    'pre': ['class'],
}


def sanitize_html(html_content):
    """
    Sanitize HTML content to prevent XSS attacks.

    This function:
    1. Removes all <script> tags and their content
    2. Removes all event handlers (onclick, onload, etc.)
    3. Only allows specific safe HTML tags
    4. Only allows specific safe attributes per tag
    5. Removes javascript: protocols from URLs

    Args:
        html_content (str): Raw HTML content to sanitize

    Returns:
        str: Sanitized HTML content
    """
    if not html_content:
        return ''

    # Parse HTML with BeautifulSoup
    soup = BeautifulSoup(html_content, 'lxml')

    # Remove all script tags
    for script in soup.find_all('script'):
        script.decompose()

    # Remove all style tags (to prevent CSS-based attacks)
    for style in soup.find_all('style'):
        style.decompose()

    # Process all tags
    for tag in soup.find_all(True):
        # Remove tags that are not in allowed list
        if tag.name not in ALLOWED_TAGS:
            tag.unwrap()
            continue

        # Get allowed attributes for this tag
        allowed_attrs = ALLOWED_ATTRIBUTES.get(tag.name, [])

        # Remove attributes that are not allowed
        attrs_to_remove = []
        for attr in tag.attrs:
            # Remove event handlers (onclick, onload, etc.)
            if attr.startswith('on'):
                attrs_to_remove.append(attr)
            # Remove non-allowed attributes
            elif attr not in allowed_attrs:
                attrs_to_remove.append(attr)
            # Check for javascript: protocol in URLs
            elif attr in ['href', 'src']:
                url = tag.attrs[attr]
                if isinstance(url, str) and url.strip().lower().startswith('javascript:'):
                    attrs_to_remove.append(attr)
            # Check for dangerous content in style attribute
            elif attr == 'style':
                style_value = tag.attrs[attr]
                if isinstance(style_value, str):
                    # Remove expressions, imports, and other dangerous CSS
                    dangerous_css = ['expression', 'import', 'behavior', '@import']
                    if any(dangerous in style_value.lower() for dangerous in dangerous_css):
                        attrs_to_remove.append(attr)

        for attr in attrs_to_remove:
            del tag.attrs[attr]

    # Get the body content (lxml parser wraps content in html/body tags)
    body = soup.find('body')
    if body:
        return ''.join(str(child) for child in body.children)

    return str(soup)


def extract_table_of_contents(html_content):
    """
    Extract headings from HTML content to generate a table of contents.

    This function:
    1. Parses HTML content to find all heading tags (h1-h6)
    2. Generates unique IDs for each heading based on its text content
    3. Adds IDs to heading elements for anchor linking
    4. Returns both the modified HTML and the ToC structure

    Args:
        html_content (str): HTML content to parse

    Returns:
        tuple: (modified_html, toc_list)
            - modified_html (str): HTML with IDs added to headings
            - toc_list (list): List of dictionaries containing:
                - level (int): Heading level (1-6)
                - text (str): Heading text content
                - id (str): Unique identifier for the heading

    Example:
        >>> html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
        >>> modified_html, toc = extract_table_of_contents(html)
        >>> toc
        [
            {'level': 1, 'text': 'Title', 'id': 'title'},
            {'level': 2, 'text': 'Subtitle', 'id': 'subtitle'},
            {'level': 3, 'text': 'Section', 'id': 'section'}
        ]
    """
    if not html_content:
        return html_content, []

    soup = BeautifulSoup(html_content, 'html.parser')
    headings = []
    id_counts = {}  # Track duplicate IDs

    # Find all heading tags (h1-h6)
    for heading in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
        # Extract text content
        text = heading.get_text().strip()
        if not text:
            continue

        # Get heading level (h1 -> 1, h2 -> 2, etc.)
        level = int(heading.name[1])

        # Check if heading already has an ID
        heading_id = heading.get('id')

        if not heading_id:
            # Generate ID from text: lowercase, replace spaces with hyphens, remove special chars
            heading_id = re.sub(r'[^\w\s-]', '', text.lower())
            heading_id = re.sub(r'[-\s]+', '-', heading_id).strip('-')

        # Handle duplicate IDs by appending a number
        if heading_id in id_counts:
            id_counts[heading_id] += 1
            heading_id = f"{heading_id}-{id_counts[heading_id]}"
        else:
            id_counts[heading_id] = 0

        # Add ID to the heading element in the HTML
        heading['id'] = heading_id

        headings.append({
            'level': level,
            'text': text,
            'id': heading_id
        })

    # Return modified HTML and ToC list
    return str(soup), headings
