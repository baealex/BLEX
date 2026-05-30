from django.test import SimpleTestCase, override_settings

from board.services.post_content_service import PostContentService


class PostContentServiceTest(SimpleTestCase):
    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_strips_same_origin_media_urls(self):
        html = (
            '<figure>'
            '<img src="https://blex.example/resources/media/images/content/a.png" '
            'data-src="https://blex.example/resources/media/images/content/a.preview.jpg" '
            'srcset="https://blex.example/resources/media/images/content/a.png 1x, '
            'https://blex.example/resources/media/images/content/a@2x.png 2x" />'
            '<video poster="https://blex.example/resources/media/images/content/poster.jpg">'
            '<source src="https://blex.example/resources/media/images/content/a.mp4?token=1#t=0" '
            'srcset="https://blex.example/resources/media/images/content/a.webm 1x" />'
            '</video>'
            '</figure>'
        )

        normalized = PostContentService.normalize_content_html(html)

        self.assertNotIn('https://blex.example', normalized)
        self.assertIn('src="/resources/media/images/content/a.png"', normalized)
        self.assertIn('data-src="/resources/media/images/content/a.preview.jpg"', normalized)
        self.assertIn('/resources/media/images/content/a@2x.png 2x', normalized)
        self.assertIn('poster="/resources/media/images/content/poster.jpg"', normalized)
        self.assertIn('src="/resources/media/images/content/a.mp4?token=1#t=0"', normalized)
        self.assertIn('srcset="/resources/media/images/content/a.webm 1x"', normalized)

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_keeps_external_media_urls(self):
        html = (
            '<p><img src="https://cdn.example/resources/media/images/content/a.png"></p>'
            '<video poster="https://video.example/resources/media/poster.jpg">'
            '<source src="https://video.example/resources/media/a.mp4">'
            '</video>'
        )

        self.assertEqual(PostContentService.normalize_content_html(html), html)

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_ignores_non_media_same_origin_urls(self):
        html = '<p><img src="https://blex.example/assets/images/logo.png"></p>'

        self.assertEqual(PostContentService.normalize_content_html(html), html)

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_preserves_unrelated_markup(self):
        html = (
            '<p data-note="keep & raw">Hello<br></p>'
            '<img class="hero" src="https://blex.example/resources/media/images/content/a.png" />'
        )

        normalized = PostContentService.normalize_content_html(html)

        self.assertEqual(
            normalized,
            '<p data-note="keep & raw">Hello<br></p>'
            '<img class="hero" src="/resources/media/images/content/a.png" />',
        )

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_ignores_comments_and_script_text(self):
        html = (
            '<!-- <img src="https://blex.example/resources/media/images/content/comment.png"> -->'
            '<script>const html = \'<img src="https://blex.example/resources/media/images/content/script.png">\';</script>'
            '<img src="https://blex.example/resources/media/images/content/real.png">'
        )

        normalized = PostContentService.normalize_content_html(html)

        self.assertIn('https://blex.example/resources/media/images/content/comment.png', normalized)
        self.assertIn('https://blex.example/resources/media/images/content/script.png', normalized)
        self.assertIn('src="/resources/media/images/content/real.png"', normalized)

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_uses_parser_position_not_matching_comment_text(self):
        raw_tag = '<img src="https://blex.example/resources/media/images/content/a.png">'
        html = f'<!-- {raw_tag} -->{raw_tag}'

        normalized = PostContentService.normalize_content_html(html)

        self.assertEqual(
            normalized,
            f'<!-- {raw_tag} --><img src="/resources/media/images/content/a.png">',
        )

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_handles_angle_brackets_in_attributes(self):
        html = '<img alt="1 > 0" src="https://blex.example/resources/media/images/content/a.png">'

        self.assertEqual(
            PostContentService.normalize_content_html(html),
            '<img alt="1 > 0" src="/resources/media/images/content/a.png">',
        )

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_preserves_external_srcset_formatting(self):
        html = (
            '<img src="https://blex.example/resources/media/images/content/a.png">'
            '<img srcset="https://cdn.example/a.png 1x,https://cdn.example/b.png 2x">'
        )

        normalized = PostContentService.normalize_content_html(html)

        self.assertIn(
            '<img srcset="https://cdn.example/a.png 1x,https://cdn.example/b.png 2x">',
            normalized,
        )

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_preserves_data_url_commas_in_srcset(self):
        html = (
            '<img srcset="data:image/png;base64,AAAA 1x, '
            'https://blex.example/resources/media/images/content/a.png 2x">'
        )

        self.assertEqual(
            PostContentService.normalize_content_html(html),
            '<img srcset="data:image/png;base64,AAAA 1x, '
            '/resources/media/images/content/a.png 2x">',
        )

    @override_settings(
        SITE_URL='https://blex.example',
        MEDIA_URL='/resources/media/',
    )
    def test_normalize_content_html_handles_unquoted_media_attributes(self):
        html = '<img src=https://blex.example/resources/media/images/content/a.png>'

        self.assertEqual(
            PostContentService.normalize_content_html(html),
            '<img src=/resources/media/images/content/a.png>',
        )
