from django.test import TestCase

from modules.markdown import (
    parse_to_html,
    parse_post_to_html,
    parse_comment_to_html,
)


class ParseToHtmlTest(TestCase):
    def test_style_tag_escaped(self):
        """<style> should be escaped to prevent browser from hiding content."""
        md = (
            'Some text\n'
            '<style> tag here\n'
            '\n'
            '## After\n'
            '\n'
            'This should be visible.\n'
        )
        result = parse_to_html(md)
        self.assertNotIn('<style>', result)
        self.assertIn('This should be visible.', result)

    def test_script_tag_escaped(self):
        """<script> should be escaped."""
        md = (
            'Some text\n'
            '<script> tag here\n'
            '\n'
            '## After\n'
            '\n'
            'This should be visible.\n'
        )
        result = parse_to_html(md)
        self.assertNotIn('<script>', result)
        self.assertIn('This should be visible.', result)

    def test_div_tag_escaped(self):
        """<div> should be escaped as plain text."""
        md = '<div class="custom">content</div>\n\nAfter div.\n'
        result = parse_to_html(md)
        self.assertNotIn('<div class', result)
        self.assertIn('After div.', result)

    def test_style_inside_fenced_code_preserved(self):
        """<style> inside fenced code blocks should remain properly escaped."""
        md = (
            '```html\n'
            '<style>\n'
            '  .red { color: red; }\n'
            '</style>\n'
            '```\n'
            '\n'
            'This should be visible.\n'
        )
        result = parse_to_html(md)
        self.assertIn('&lt;style&gt;', result)
        self.assertIn('This should be visible.', result)

    def test_style_inside_tilde_fence_preserved(self):
        """<style> inside tilde fenced code blocks should work correctly."""
        md = (
            '~~~html\n'
            '<style>\n'
            '  .red { color: red; }\n'
            '</style>\n'
            '~~~\n'
            '\n'
            'This should be visible.\n'
        )
        result = parse_to_html(md)
        self.assertIn('&lt;style&gt;', result)
        self.assertIn('This should be visible.', result)

    def test_mixed_code_and_text_with_style(self):
        """Style tags in code blocks + text should all render correctly."""
        md = (
            '## CSS Example\n'
            '\n'
            '```html\n'
            '<style>\n'
            '  body { margin: 0; }\n'
            '</style>\n'
            '```\n'
            '\n'
            'Use `<style>` tag in your HTML.\n'
            '\n'
            'Also:\n'
            '<style> tag can be placed in the head.\n'
            '\n'
            '## Conclusion\n'
            '\n'
            'All content should be visible.\n'
        )
        result = parse_to_html(md)
        self.assertNotIn('<style>', result)
        self.assertIn('All content should be visible.', result)

    def test_inline_code_not_double_escaped(self):
        """<style> in backtick inline code should not be double-escaped."""
        md = 'Use `<style>` to add CSS.\n'
        result = parse_to_html(md)
        self.assertIn('<code>&lt;style&gt;</code>', result)

    def test_allowed_markup_br(self):
        """<br> should be allowed and converted."""
        md = 'Line 1<br>Line 2\n'
        result = parse_to_html(md)
        self.assertIn('<br/>', result)

    def test_allowed_markup_center(self):
        """<center> should be allowed and converted to div."""
        md = '<center>centered</center>\n'
        result = parse_to_html(md)
        self.assertIn('text-align: center', result)

    def test_allowed_markup_grid_image(self):
        """<grid-image> should be allowed and converted to figure."""
        md = (
            '<grid-image col="2">\n'
            '![img](test.jpg)\n'
            '<caption>Caption</caption>\n'
            '</grid-image>\n'
        )
        result = parse_to_html(md)
        self.assertIn('<figure class="col-2">', result)
        self.assertIn('<figcaption>Caption</figcaption>', result)
        self.assertIn('</figure>', result)

    def test_post_markdown_does_not_render_mentions(self):
        """Post markdown should not convert mention syntax to links."""
        md = '`@author`'
        result = parse_post_to_html(md)
        self.assertNotIn('class="mention"', result)
        self.assertIn('<code>@author</code>', result)

    def test_comment_markdown_renders_mentions(self):
        """Comment markdown should convert mention syntax to links."""
        md = '`@author`'
        result = parse_comment_to_html(md)
        self.assertIn('class="mention"', result)
        self.assertIn('href="/@author"', result)

    def test_parse_to_html_defaults_to_post_markdown(self):
        """Backward compatible parse_to_html should follow post rules."""
        md = '`@author`'
        result = parse_to_html(md)
        self.assertNotIn('class="mention"', result)
        self.assertIn('<code>@author</code>', result)
