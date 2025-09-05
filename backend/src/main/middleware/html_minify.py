import re
from django.utils.deprecation import MiddlewareMixin


class HTMLMinifyMiddleware(MiddlewareMixin):
    """
    HTML 압축 미들웨어 - 안전하고 견고한 압축
    """
    
    def __init__(self, get_response=None):
        self.get_response = get_response
        self.async_mode = False
        
        # 보존할 태그들의 정규식 패턴 (텍스트 영역과 코드 블록만)
        self.preserve_patterns = [
            (re.compile(r'(<pre[^>]*>.*?</pre>)', re.DOTALL | re.IGNORECASE), 'PRE'),
            (re.compile(r'(<code[^>]*>.*?</code>)', re.DOTALL | re.IGNORECASE), 'CODE'),
            (re.compile(r'(<textarea[^>]*>.*?</textarea>)', re.DOTALL | re.IGNORECASE), 'TEXTAREA'),
        ]
        
        # CSS 압축을 위한 별도 패턴
        self.style_pattern = re.compile(r'(<style[^>]*>)(.*?)(</style>)', re.DOTALL | re.IGNORECASE)
        
        # JavaScript 압축을 위한 별도 패턴 (src 속성이 없는 인라인 스크립트만)
        self.script_pattern = re.compile(r'(<script(?![^>]*src=)[^>]*>)(.*?)(</script>)', re.DOTALL | re.IGNORECASE)

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
        
        # 3단계: 스크립트 태그 JavaScript 압축 처리
        def minify_script(match):
            opening_tag = match.group(1)
            js_content = match.group(2)
            closing_tag = match.group(3)
            
            minified_js = self._minify_js(js_content)
            return opening_tag + minified_js + closing_tag
            
        content = self.script_pattern.sub(minify_script, content)
        
        # 4단계: HTML 주석 제거 (조건부 주석은 보존)
        content = re.sub(r'<!--(?!\s*(?:\[if|<!)).*?-->', '', content, flags=re.DOTALL)
        
        # 5단계: 공백 정리
        content = self._clean_whitespace(content)
        
        # 6단계: 보존된 블록 복원
        for placeholder, original in preserved_blocks.items():
            content = content.replace(placeholder, original)
            
        return content

    def _clean_whitespace(self, content):
        """공백을 최소한으로만 정리 (레이아웃 보존)"""
        # 연속된 줄바꿈만 하나로 줄이기
        content = re.sub(r'\n\s*\n', '\n', content)
        
        # 탭을 공백으로 변환
        content = content.replace('\t', ' ')
        
        # 연속된 공백을 하나로 (단, 완전히 제거하지는 않음)
        content = re.sub(r' +', ' ', content)
        
        # 앞뒤 공백만 제거
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

    def _minify_js(self, js_content):
        """JavaScript를 안전하게 압축"""
        if not js_content.strip():
            return js_content
        
        # 단일행 주석 제거 (//)
        js_content = re.sub(r'//.*?$', '', js_content, flags=re.MULTILINE)
        
        # 다중행 주석 제거 (/* ... */)
        js_content = re.sub(r'/\*.*?\*/', '', js_content, flags=re.DOTALL)
        
        # 연속된 공백, 탭, 줄바꿈을 하나의 공백으로
        js_content = re.sub(r'\s+', ' ', js_content)
        
        # 중괄호 주변 공백 제거
        js_content = re.sub(r'\s*{\s*', '{', js_content)
        js_content = re.sub(r'\s*}\s*', '}', js_content)
        
        # 세미콜론 주변 공백 정리
        js_content = re.sub(r'\s*;\s*', ';', js_content)
        
        # 콜론 주변 공백 정리
        js_content = re.sub(r'\s*:\s*', ':', js_content)
        
        # 콤마 주변 공백 정리
        js_content = re.sub(r'\s*,\s*', ',', js_content)
        
        # 소괄호 주변 공백 제거
        js_content = re.sub(r'\s*\(\s*', '(', js_content)
        js_content = re.sub(r'\s*\)\s*', ')', js_content)
        
        # 대괄호 주변 공백 제거
        js_content = re.sub(r'\s*\[\s*', '[', js_content)
        js_content = re.sub(r'\s*\]\s*', ']', js_content)
        
        # 연산자 주변 공백 정리 (기본적인 것들만)
        js_content = re.sub(r'\s*=\s*', '=', js_content)
        js_content = re.sub(r'\s*\+\s*', '+', js_content)
        js_content = re.sub(r'\s*-\s*', '-', js_content)
        
        # 앞뒤 공백 제거
        js_content = js_content.strip()
        
        return js_content
