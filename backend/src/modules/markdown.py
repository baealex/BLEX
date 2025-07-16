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
        md.treeprocessors.register(HeaderHashTreeprocessor(md), 'header_hash', 175)
        md.treeprocessors.register(LazyImageTreeprocessor(md), 'lazy_image', 176)

class CustomPreprocessor(Preprocessor):
    def run(self, lines):
        new_lines = []
        for line in lines:
            # Convert checkbox syntax
            line = re.sub(r'^- \[ \] ', '- [ ] ', line)
            line = re.sub(r'^- \[x\] ', '- [x] ', line)
            new_lines.append(line)
        return new_lines

class CustomPostprocessor:
    @staticmethod
    def process(html_content):
        # Custom Markdown
        html_content = re.sub(
            r'@gif\[.*(https?://.*\.mp4).*\]',
            r'<video class="lazy" autoplay muted loop playsinline poster="\1.preview.jpg"><source data-src="\1" type="video/mp4"/></video>',
            html_content
        )
        html_content = re.sub(
            r'@youtube\[(.*)\]',
            r'<iframe width="100%" height="350" src="https://www.youtube.com/embed/\1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
            html_content
        )
        html_content = re.sub(r'<li>\[ \] ', r'<li class="checkbox">', html_content)
        html_content = re.sub(r'<li>\[x\] ', r'<li class="checkbox checked">', html_content)
        
        # Allow Markup
        html_content = re.sub(r'&lt;br\/?&gt;', '<br/>', html_content)
        html_content = re.sub(r'&lt;center&gt;', '<div style="text-align: center;">', html_content)
        html_content = re.sub(r'&lt;\/center&gt;', '</div>', html_content)
        
        # Grid Image
        html_content = re.sub(r'&lt;grid-image col=&quot;(1|2|3)&quot;&gt;', r'<figure class="col-\1">', html_content)
        html_content = re.sub(r'&lt;caption&gt;(.*)&lt;\/caption&gt;', r'<figcaption>\1</figcaption>', html_content)
        html_content = re.sub(r'&lt;\/grid-image&gt;', '</figure>', html_content)
        
        return html_content

def parse_to_html(text):
    """
    Parse markdown text to HTML using Python implementation of blexer
    """
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
    html_content = CustomPostprocessor.process(html_content)
    
    return html_content

# For backward compatibility
def get_images(markdown_text):
    """
    Extract image URLs from markdown text
    """
    return re.findall(r'!\[[^\]]*\]\((.*?)\s*("(?:.*[^"])")?\s*\)', markdown_text)
