import re
import markdown
from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor
from markdown.preprocessors import Preprocessor
from markdown.extensions.toc import slugify_unicode

class HeaderHashTreeprocessor(Treeprocessor):
    def __init__(self, md):
        super().__init__(md)
        self.ids = []
        
    def make_id(self, text):
        id_text = slugify_unicode(text, '-')
        id_text = id_text[:25]  # Limit to 25 chars like JS version
        
        if not id_text:
            id_text = 'header'
            
        # Handle duplicates
        for idx in range(100):  # Reasonable limit to prevent infinite loop
            temp_id = f"{id_text}{'-' + str(idx) if idx != 0 else ''}"
            if temp_id not in self.ids:
                self.ids.append(temp_id)
                return temp_id
        
        return id_text  # Fallback
    
    def run(self, root):
        for elem in root.iter():
            if elem.tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                # Adjust header level to match JS implementation
                level = int(elem.tag[1])
                if level % 2 == 1:
                    level += 1
                    elem.tag = f'h{level}'
                
                # Add id attribute
                if elem.text:
                    elem.set('id', self.make_id(elem.text))
        return root

class LazyImageTreeprocessor(Treeprocessor):
    def run(self, root):
        for elem in root.iter('img'):
            if 'src' in elem.attrib:
                src = elem.attrib['src']
                elem.set('class', 'lazy')
                elem.set('data-src', src)
                elem.set('src', f"{src}.preview.jpg")
        return root

class CustomMarkdownExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(CustomPreprocessor(md), 'custom_preprocessor', 30)
        md.treeprocessors.register(HeaderHashTreeprocessor(md), 'header_hash', 175)
        md.treeprocessors.register(LazyImageTreeprocessor(md), 'lazy_image', 176)

class CustomPreprocessor(Preprocessor):
    # Escape all raw HTML tags outside fenced code blocks and inline code.
    # The postprocessor selectively re-enables allowed markup
    # (<br>, <center>, <grid-image>, <caption>).
    HTML_TAG = re.compile(r'<(/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^>]*)?)>')
    FENCE_PATTERN = re.compile(r'^(`{3,}|~{3,})')

    @staticmethod
    def _escape_html_outside_backticks(line):
        """Escape HTML tags in a line, but skip content inside backtick spans."""
        parts = line.split('`')
        # Odd-indexed parts are inside backticks
        for i in range(0, len(parts), 2):
            parts[i] = CustomPreprocessor.HTML_TAG.sub(r'&lt;\1&gt;', parts[i])
        return '`'.join(parts)

    def run(self, lines):
        new_lines = []
        in_fence = False
        fence_char = None

        for line in lines:
            # Track fenced code blocks
            fence_match = self.FENCE_PATTERN.match(line)
            if fence_match:
                if not in_fence:
                    in_fence = True
                    fence_char = fence_match.group(1)[0]
                elif line.strip().startswith(fence_char * 3):
                    in_fence = False
                    fence_char = None

            if not in_fence:
                line = self._escape_html_outside_backticks(line)

            # Convert checkbox syntax
            line = re.sub(r'^- \[ \] ', '- [ ] ', line)
            line = re.sub(r'^- \[x\] ', '- [x] ', line)
            new_lines.append(line)
        return new_lines

class CustomPostprocessor:
    @staticmethod
    def process(html_content, enable_mentions=False):
        # Custom Markdown
        html_content = re.sub(
            r'@gif\[.*(https?://.*\.mp4).*\]',
            r'<video class="lazy" autoplay muted loop playsinline poster="\1.preview.jpg"><source data-src="\1" type="video/mp4"/></video>',
            html_content
        )
        # YouTube with aspect ratio: @youtube[ID]{16:9} or @youtube[ID]
        def youtube_replace(match):
            video_id = match.group(1)
            aspect_ratio = match.group(2) if match.group(2) else '16:9'
            aspect_css = aspect_ratio.replace(':', ' / ')
            return f'<figure style="text-align: center; display: flex; justify-content: center; flex-direction: column; align-items: center;"><iframe style="width: 100%; aspect-ratio: {aspect_css}; border: 0;" data-aspect-ratio="{aspect_ratio}" src="https://www.youtube.com/embed/{video_id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></figure>'

        html_content = re.sub(
            r'@youtube\[([^\]]+)\](?:\{([^\}]+)\})?',
            youtube_replace,
            html_content
        )
        html_content = re.sub(r'<li>\[ \] ', r'<li class="checkbox">', html_content)
        html_content = re.sub(r'<li>\[x\] ', r'<li class="checkbox checked">', html_content)

        if enable_mentions:
            # Mention: `@username` -> <a href="/@username" class="mention">@username</a>
            html_content = re.sub(
                r'<code>@([a-zA-Z0-9\.]+)</code>',
                r'<a href="/@\1" class="mention">@\1</a>',
                html_content
            )

        # Allow Markup
        html_content = re.sub(r'&lt;br\/?&gt;', '<br/>', html_content)
        html_content = re.sub(r'&lt;center&gt;', '<div style="text-align: center;">', html_content)
        html_content = re.sub(r'&lt;\/center&gt;', '</div>', html_content)

        # Grid Image (quotes may appear as &quot; or literal ")
        html_content = re.sub(r'&lt;grid-image col=(?:&quot;|")(1|2|3)(?:&quot;|")&gt;', r'<figure class="col-\1">', html_content)
        html_content = re.sub(r'&lt;caption&gt;(.*)&lt;/caption&gt;', r'<figcaption>\1</figcaption>', html_content)
        html_content = re.sub(r'&lt;/grid-image&gt;', '</figure>', html_content)

        return html_content

def _parse_to_html(text, enable_mentions=False):
    """Parse markdown text to HTML with optional mention rendering."""
    # Initialize Markdown with extensions
    md = markdown.Markdown(extensions=[
        'markdown.extensions.fenced_code',
        'markdown.extensions.tables',
        'markdown.extensions.nl2br',
        'markdown.extensions.sane_lists',
        'pymdownx.extra',
        'pymdownx.superfences',
        'pymdownx.tasklist',
        'pymdownx.tilde',
        'pymdownx.mark',
        CustomMarkdownExtension()
    ])
    
    # Convert markdown to HTML
    html_content = md.convert(text)
    
    # Apply post-processing
    html_content = CustomPostprocessor.process(
        html_content,
        enable_mentions=enable_mentions
    )
    
    return html_content


def parse_post_to_html(text):
    """Parse post markdown to HTML (mentions disabled)."""
    return _parse_to_html(text, enable_mentions=False)


def parse_comment_to_html(text):
    """Parse comment markdown to HTML (mentions enabled)."""
    return _parse_to_html(text, enable_mentions=True)


# For backward compatibility
def parse_to_html(text):
    """
    Backward-compatible alias for post markdown parsing.
    """
    return parse_post_to_html(text)


# For backward compatibility
def get_images(markdown_text):
    """
    Extract image URLs from markdown text
    """
    return re.findall(r'!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)', markdown_text)
