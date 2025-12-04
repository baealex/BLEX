"""
HTML 태그 검증 서비스
"""
import re
from typing import List, Dict, Any


class HTMLValidationService:
    """HTML 태그 검증 서비스"""

    @staticmethod
    def find_mismatched_tags(html_content: str) -> List[Dict[str, Any]]:
        """잘못 매칭된 HTML 태그 찾기 (헤딩 태그만)"""
        # 헤딩 태그만 검사
        heading_tags = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}

        # 태그 패턴: <tag> 또는 </tag>
        tag_pattern = re.compile(r'<(/?)(\w+)(?:\s[^>]*)?>|</(\w+)>')

        stack = []
        mismatches = []

        for match in tag_pattern.finditer(html_content):
            is_closing = match.group(1) == '/' or match.group(3) is not None
            tag_name = match.group(2) or match.group(3)

            # 헤딩 태그가 아니면 무시
            if tag_name.lower() not in heading_tags:
                continue

            if not is_closing:
                # 여는 태그
                stack.append({
                    'tag': tag_name,
                    'position': match.start(),
                    'full_match': match.group(0)
                })
            else:
                # 닫는 태그
                if not stack:
                    mismatches.append({
                        'type': 'extra_closing',
                        'tag': tag_name,
                        'position': match.start(),
                        'text': match.group(0)
                    })
                elif stack[-1]['tag'].lower() != tag_name.lower():
                    # 태그 불일치
                    opening = stack.pop()
                    mismatches.append({
                        'type': 'mismatch',
                        'opening_tag': opening['tag'],
                        'closing_tag': tag_name,
                        'opening_position': opening['position'],
                        'closing_position': match.start(),
                        'opening_text': opening['full_match'],
                        'closing_text': match.group(0)
                    })
                else:
                    # 정상 매칭
                    stack.pop()

        # 닫히지 않은 태그
        for unclosed in stack:
            mismatches.append({
                'type': 'unclosed',
                'tag': unclosed['tag'],
                'position': unclosed['position'],
                'text': unclosed['full_match']
            })

        return mismatches

    @staticmethod
    def fix_mismatched_tags(html_content: str, mismatches: List[Dict[str, Any]]) -> str:
        """잘못된 태그 수정"""
        fixed_html = html_content
        offset = 0

        # 매칭 오류만 수정 (여는 태그와 닫는 태그가 다른 경우)
        for mismatch in sorted(mismatches, key=lambda x: x.get('closing_position', x.get('position', 0))):
            if mismatch['type'] == 'mismatch':
                # 닫는 태그를 여는 태그와 맞춤
                old_closing = mismatch['closing_text']
                new_closing = f"</{mismatch['opening_tag']}>"

                pos = mismatch['closing_position'] + offset
                before = fixed_html[:pos]
                after = fixed_html[pos:]

                # 닫는 태그 교체
                after = after.replace(old_closing, new_closing, 1)
                fixed_html = before + after

                offset += len(new_closing) - len(old_closing)

        return fixed_html
