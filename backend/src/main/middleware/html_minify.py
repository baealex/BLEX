import re
from django.utils.deprecation import MiddlewareMixin


class HTMLMinifyMiddleware(MiddlewareMixin):
    """
    HTML 압축 미들웨어 - 안전하고 견고한 압축
    """
    
    def __init__(self, get_response=None):
        self.get_response = get_response
        self.async_mode = False
        
        # 보존할 태그들의 정규식 패턴 (스크립트와 텍스트 영역만)
        self.preserve_patterns = [
            (re.compile(r'(<script[^>]*>.*?</script>)', re.DOTALL | re.IGNORECASE), 'SCRIPT'),
            (re.compile(r'(<pre[^>]*>.*?</pre>)', re.DOTALL | re.IGNORECASE), 'PRE'),
            (re.compile(r'(<code[^>]*>.*?</code>)', re.DOTALL | re.IGNORECASE), 'CODE'),
            (re.compile(r'(<textarea[^>]*>.*?</textarea>)', re.DOTALL | re.IGNORECASE), 'TEXTAREA'),
        ]
        
        # CSS 압축을 위한 별도 패턴
        self.style_pattern = re.compile(r'(<style[^>]*>)(.*?)(</style>)', re.DOTALL | re.IGNORECASE)

    def process_response(self, request, response):
        # HTML 응답만 처리
        content_type = response.get('Content-Type', '')
        if 'text/html' not in content_type:
            return response
            
        # 관리자 페이지는 제외
        if request.path.startswith('/admin/'):
            return response
            
        try:
            content = response.content.decode('utf-8')
            minified_content = self._minify_html(content)
            
            response.content = minified_content.encode('utf-8')
            response['Content-Length'] = len(response.content)
            
        except Exception:
            # 오류 발생 시 원본 그대로 반환
            pass
            
        return response

    def _minify_html(self, content):
        """HTML을 안전하게 압축"""
        if not content.strip():
            return content
            
        # 1단계: 보존할 태그들을 플레이스홀더로 대체
        preserved_blocks = {}
        for pattern, tag_type in self.preserve_patterns:
            def preserve_block(match):
                placeholder = f'__PRESERVE_{tag_type}_{len(preserved_blocks)}__'
                preserved_blocks[placeholder] = match.group(1)
                return placeholder
            content = pattern.sub(preserve_block, content)
        
        # 2단계: 스타일 태그 CSS 압축 처리
        def minify_style(match):
            opening_tag = match.group(1)
            css_content = match.group(2)
            closing_tag = match.group(3)
            
            minified_css = self._minify_css(css_content)
            return opening_tag + minified_css + closing_tag
            
        content = self.style_pattern.sub(minify_style, content)
        
        # 3단계: HTML 주석 제거 (조건부 주석은 보존)
        content = re.sub(r'<!--(?!\s*(?:\[if|<!)).*?-->', '', content, flags=re.DOTALL)
        
        # 4단계: 공백 정리
        content = self._clean_whitespace(content)
        
        # 5단계: 보존된 블록 복원
        for placeholder, original in preserved_blocks.items():
            content = content.replace(placeholder, original)
            
        return content

    def _clean_whitespace(self, content):
        """공백을 안전하게 정리"""
        # 줄바꿈과 연속된 공백을 하나의 공백으로
        content = re.sub(r'\s+', ' ', content)
        
        # 태그 사이의 불필요한 공백 제거
        content = re.sub(r'>\s+<', '><', content)
        
        # 태그 시작/끝의 공백 정리
        content = re.sub(r'\s*>\s*', '>', content)
        content = re.sub(r'\s*<\s*', '<', content)
        
        # 속성 주변 공백 정리 (더 안전한 패턴)
        content = re.sub(r'\s*=\s*', '=', content)
        
        # 셀프 클로징 태그 정리
        content = re.sub(r'\s+/>', '/>', content)
        
        # 앞뒤 공백 제거
        content = content.strip()
        
        return content

    def _minify_css(self, css_content):
        """CSS를 안전하게 압축"""
        if not css_content.strip():
            return css_content
        
        # CSS 주석 제거 (/* ... */ 형식)
        css_content = re.sub(r'/\*.*?\*/', '', css_content, flags=re.DOTALL)
        
        # 연속된 공백, 탭, 줄바꿈을 하나의 공백으로
        css_content = re.sub(r'\s+', ' ', css_content)
        
        # 중괄호 주변 공백 제거
        css_content = re.sub(r'\s*{\s*', '{', css_content)
        css_content = re.sub(r'\s*}\s*', '}', css_content)
        
        # 세미콜론 주변 공백 정리
        css_content = re.sub(r'\s*;\s*', ';', css_content)
        
        # 콜론 주변 공백 정리
        css_content = re.sub(r'\s*:\s*', ':', css_content)
        
        # 콤마 주변 공백 정리
        css_content = re.sub(r'\s*,\s*', ',', css_content)
        
        # 마지막 세미콜론 전 공백 제거
        css_content = re.sub(r'\s*;\s*}', '}', css_content)
        
        # 앞뒤 공백 제거
        css_content = css_content.strip()
        
        return css_content
