"""
Tests for board app utility functions
"""
from django.test import TestCase

from board.utils import extract_table_of_contents


class TableOfContentsTestCase(TestCase):
    """Test cases for the table of contents extraction function"""

    def test_extract_toc_from_simple_html(self):
        """Test extracting ToC from HTML with simple headings"""
        html = """
        <h1>Introduction</h1>
        <p>Some content</p>
        <h2>Getting Started</h2>
        <p>More content</p>
        <h3>Installation</h3>
        <p>Even more content</p>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 3)
        self.assertEqual(toc[0]['text'], 'Introduction')
        self.assertEqual(toc[0]['level'], 1)
        self.assertEqual(toc[0]['id'], 'introduction')

        self.assertEqual(toc[1]['text'], 'Getting Started')
        self.assertEqual(toc[1]['level'], 2)
        self.assertEqual(toc[1]['id'], 'getting-started')

        self.assertEqual(toc[2]['text'], 'Installation')
        self.assertEqual(toc[2]['level'], 3)
        self.assertEqual(toc[2]['id'], 'installation')

        # Verify IDs are added to headings in modified HTML
        self.assertIn('id="introduction"', modified_html)
        self.assertIn('id="getting-started"', modified_html)
        self.assertIn('id="installation"', modified_html)

    def test_extract_toc_with_duplicate_headings(self):
        """Test that duplicate heading texts get unique IDs"""
        html = """
        <h2>Overview</h2>
        <p>First section</p>
        <h2>Overview</h2>
        <p>Second section</p>
        <h2>Overview</h2>
        <p>Third section</p>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 3)
        self.assertEqual(toc[0]['id'], 'overview')
        self.assertEqual(toc[1]['id'], 'overview-1')
        self.assertEqual(toc[2]['id'], 'overview-2')

    def test_extract_toc_with_existing_ids(self):
        """Test that existing IDs are preserved"""
        html = """
        <h1 id="custom-id">Custom Heading</h1>
        <h2>Regular Heading</h2>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 2)
        self.assertEqual(toc[0]['id'], 'custom-id')
        self.assertEqual(toc[1]['id'], 'regular-heading')

    def test_extract_toc_with_special_characters(self):
        """Test that special characters are removed from generated IDs"""
        html = """
        <h2>Hello, World!</h2>
        <h2>What's Up?</h2>
        <h2>Test & Demo</h2>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 3)
        self.assertEqual(toc[0]['id'], 'hello-world')
        self.assertEqual(toc[1]['id'], 'whats-up')
        self.assertEqual(toc[2]['id'], 'test-demo')

    def test_extract_toc_with_korean_text(self):
        """Test that Korean text is handled correctly"""
        html = """
        <h1>소개</h1>
        <h2>시작하기</h2>
        <h3>설치 방법</h3>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 3)
        self.assertEqual(toc[0]['text'], '소개')
        self.assertEqual(toc[1]['text'], '시작하기')
        self.assertEqual(toc[2]['text'], '설치 방법')

        # IDs should be generated (Korean characters allowed in modern slug generation)
        self.assertIsNotNone(toc[0]['id'])
        self.assertIsNotNone(toc[1]['id'])
        self.assertIsNotNone(toc[2]['id'])

    def test_extract_toc_from_empty_html(self):
        """Test that empty HTML returns empty ToC"""
        html = ""
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(toc, [])
        self.assertEqual(modified_html, "")

    def test_extract_toc_from_html_without_headings(self):
        """Test that HTML without headings returns empty ToC"""
        html = "<p>Just some text</p><div>More text</div>"
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(toc, [])

    def test_extract_toc_with_empty_headings(self):
        """Test that empty headings are ignored"""
        html = """
        <h1></h1>
        <h2>Valid Heading</h2>
        <h3>   </h3>
        <h4>Another Valid Heading</h4>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 2)
        self.assertEqual(toc[0]['text'], 'Valid Heading')
        self.assertEqual(toc[1]['text'], 'Another Valid Heading')

    def test_extract_toc_with_nested_elements(self):
        """Test that nested elements in headings are handled"""
        html = """
        <h2>Heading with <strong>bold</strong> text</h2>
        <h3>Heading with <code>code</code> block</h3>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 2)
        self.assertEqual(toc[0]['text'], 'Heading with bold text')
        self.assertEqual(toc[1]['text'], 'Heading with code block')

    def test_extract_toc_with_all_heading_levels(self):
        """Test that all heading levels (h1-h6) are extracted"""
        html = """
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
        <h5>Level 5</h5>
        <h6>Level 6</h6>
        """
        modified_html, toc = extract_table_of_contents(html)

        self.assertEqual(len(toc), 6)
        for i in range(6):
            self.assertEqual(toc[i]['level'], i + 1)
            self.assertEqual(toc[i]['text'], f'Level {i + 1}')

    def test_extract_toc_preserves_original_html_structure(self):
        """Test that the HTML structure is preserved (only IDs are added)"""
        html = """
        <div class="content">
            <h2>Title</h2>
            <p>Paragraph</p>
            <h3>Subtitle</h3>
        </div>
        """
        modified_html, toc = extract_table_of_contents(html)

        # Check that structure is preserved
        self.assertIn('<div class="content">', modified_html)
        self.assertIn('<p>Paragraph</p>', modified_html)

        # Check that IDs are added
        self.assertIn('id="title"', modified_html)
        self.assertIn('id="subtitle"', modified_html)
