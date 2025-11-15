"""
정적 페이지 템플릿 테스트
URL: /about, /privacy, /terms
"""
from django.test import TestCase, Client
from django.urls import reverse


class StaticPagesTestCase(TestCase):
    """정적 페이지 템플릿 테스트"""

    def setUp(self):
        """테스트 데이터 설정"""
        self.client = Client()

    def test_about_page_renders(self):
        """About 페이지 (/about) 정상 렌더링 테스트"""
        response = self.client.get(reverse('about'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/pages/about.html')

    def test_privacy_page_renders(self):
        """Privacy 페이지 (/privacy) 정상 렌더링 테스트"""
        response = self.client.get(reverse('privacy'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/pages/privacy.html')

    def test_terms_page_renders(self):
        """Terms 페이지 (/terms) 정상 렌더링 테스트"""
        response = self.client.get(reverse('terms'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'board/pages/terms.html')

    def test_all_static_pages_accessible(self):
        """모든 정적 페이지가 접근 가능한지 테스트"""
        pages = [
            ('about', 'board/pages/about.html'),
            ('privacy', 'board/pages/privacy.html'),
            ('terms', 'board/pages/terms.html'),
        ]

        for url_name, template in pages:
            with self.subTest(page=url_name):
                response = self.client.get(reverse(url_name))
                self.assertEqual(response.status_code, 200)
                self.assertTemplateUsed(response, template)

    def test_static_pages_without_authentication(self):
        """로그인 없이 정적 페이지 접근 가능 테스트"""
        # 명시적으로 로그아웃 상태 확인
        pages = ['about', 'privacy', 'terms']

        for page in pages:
            with self.subTest(page=page):
                response = self.client.get(reverse(page))
                self.assertEqual(response.status_code, 200)
