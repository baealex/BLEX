import re
from django.utils.deprecation import MiddlewareMixin

class HTMLMinifyMiddleware(MiddlewareMixin):
    """
    Middleware that minifies HTML content.
    """
    def __init__(self, get_response=None):
        self.get_response = get_response
        # Required for Django 5.1+ compatibility
        self.async_mode = False
        # 강화된 미니파이 패턴 - HTML과 CSS는 적극적으로 압축
        self.patterns = [
            # HTML 압축 패턴
            (re.compile(r'\s{2,}'), ' '),  # 여러 공백을 하나로
            (re.compile(r'>\s+<'), '><'),  # 태그 사이 공백 제거
            (re.compile(r'\s+/>'), '/>'),  # 셀프 클로징 태그 공백 제거
            (re.compile(r'\s+([\w\-"\'])\s*=\s*([\w\-"\'])'), r' \1=\2'),  # 속성 주변 공백 정리
            (re.compile(r'\s+$'), ''),  # 라인 끝 공백 제거
            # HTML 주석 제거 (조건부 주석 제외)
            (re.compile(r'<!--(?!<!)[^\[>].*?-->', re.DOTALL), ''),
        ]

    def process_response(self, request, response):
        # Only minify HTML responses
        if 'text/html' in response.get('Content-Type', ''):
            # Skip minification for admin pages
            if request.path.startswith('/admin/'):
                return response
                
            # Get the response content
            content = response.content.decode('utf-8')
            
            # 1. 자바스크립트 보호 - 스크립트 태그와 내용을 임시 저장
            script_blocks = {}
            script_pattern = re.compile(r'<script[^>]*>.*?</script>', re.DOTALL)
            
            def save_scripts(match):
                placeholder = f'SCRIPT_PLACEHOLDER_{len(script_blocks)}'
                script_blocks[placeholder] = match.group(0)
                return placeholder
            
            # 스크립트를 플레이스홀더로 대체
            content = script_pattern.sub(save_scripts, content)
            
            # 2. 스타일 태그 처리 - 내부 공백만 최적화
            style_blocks = {}
            style_pattern = re.compile(r'<style[^>]*>(.*?)</style>', re.DOTALL)
            
            def process_styles(match):
                placeholder = f'STYLE_PLACEHOLDER_{len(style_blocks)}'
                style_content = match.group(1)
                # CSS 압축 처리
                style_content = re.sub(r'\s+', ' ', style_content)  # 여러 공백을 하나로
                style_content = re.sub(r'\s*({|})\s*', r'\1', style_content)  # 중괄호 주변 공백 제거
                style_content = re.sub(r'\s*;\s*', ';', style_content)  # 세미콜론 주변 공백 제거
                style_content = re.sub(r'\s*:\s*', ':', style_content)  # 콜론 주변 공백 제거
                style_content = re.sub(r'/\*.*?\*/', '', style_content)  # CSS 주석 제거
                style_blocks[placeholder] = f'<style>{style_content}</style>'
                return placeholder
            
            # 스타일 태그 처리
            content = style_pattern.sub(process_styles, content)
            
            # 3. HTML 압축 패턴 적용
            for pattern, replacement in self.patterns:
                content = pattern.sub(replacement, content)
            
            # 4. 스타일과 스크립트 복원
            for placeholder, style in style_blocks.items():
                content = content.replace(placeholder, style)
                
            for placeholder, script in script_blocks.items():
                content = content.replace(placeholder, script)
            
            # 5. 인라인 스타일 속성 압축
            def compress_inline_style(match):
                style_content = match.group(1)
                style_content = re.sub(r'\s+', ' ', style_content)  # 여러 공백을 하나로
                style_content = re.sub(r'\s*:\s*', ':', style_content)  # 콜론 주변 공백 제거
                style_content = re.sub(r'\s*;\s*', ';', style_content)  # 세미콜론 주변 공백 제거
                return f' style="{style_content}"'
            
            content = re.sub(r' style="([^"]+)"', compress_inline_style, content)
            
            # 응답 내용 업데이트
            response.content = content.encode('utf-8')
            
            # Content-Length 헤더 업데이트
            response['Content-Length'] = len(response.content)
            
        return response
