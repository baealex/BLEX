#!/usr/bin/env python3
"""
헤딩 태그 검증 및 재렌더링 유틸리티

이 스크립트는 다음과 같은 경우 text_html을 재렌더링합니다:
1. text_html에 id가 없는 헤딩 태그가 있는 경우
2. text_html에 h1, h3, h5 같은 홀수 레벨 헤딩이 있는 경우 (h2, h4, h6으로 변환되어야 함)
3. text_md가 있지만 text_html이 비어있는 경우
4. text_md를 다시 렌더링했을 때 현재 text_html과 다른 경우

사용법:
    # Dry-run (실제 변경 없이 확인만)
    python validate_and_rerender_markdown.py --dry-run

    # 실제 재렌더링 수행
    python validate_and_rerender_markdown.py

    # 특정 모델만 처리
    python validate_and_rerender_markdown.py --models Comment PostContent
"""

import os
import sys
import re
import argparse
import django
from html.parser import HTMLParser

# Django 환경 설정
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import Comment, PostContent, Profile, Series
from modules import markdown


class HeadingTagValidator(HTMLParser):
    """HTML에서 헤딩 태그를 파싱하고 검증하는 클래스"""

    def __init__(self):
        super().__init__()
        self.issues = []
        self.heading_tags = []

    def handle_starttag(self, tag, attrs):
        if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
            attrs_dict = dict(attrs)
            level = int(tag[1])

            # 홀수 레벨 헤딩 체크 (h1, h3, h5는 h2, h4, h6으로 변환되어야 함)
            if level % 2 == 1:
                self.issues.append(f"홀수 레벨 헤딩 발견: {tag}")

            # ID 속성 누락 체크
            if 'id' not in attrs_dict:
                self.issues.append(f"ID 누락된 헤딩: {tag}")

            self.heading_tags.append({
                'tag': tag,
                'level': level,
                'id': attrs_dict.get('id'),
                'has_id': 'id' in attrs_dict
            })

    def has_issues(self):
        return len(self.issues) > 0

    def get_issues(self):
        return self.issues


def validate_html(html_content):
    """
    HTML 콘텐츠의 헤딩 태그를 검증

    Args:
        html_content: 검증할 HTML 문자열

    Returns:
        (has_issues, issues): 이슈가 있는지 여부와 이슈 목록
    """
    validator = HeadingTagValidator()
    try:
        validator.feed(html_content)
    except Exception as e:
        return True, [f"HTML 파싱 오류: {str(e)}"]

    return validator.has_issues(), validator.get_issues()


def check_and_rerender(instance, md_field='text_md', html_field='text_html', dry_run=True):
    """
    단일 인스턴스의 마크다운을 검증하고 필요시 재렌더링

    Args:
        instance: 모델 인스턴스
        md_field: 마크다운 필드 이름
        html_field: HTML 필드 이름
        dry_run: True면 실제 저장하지 않음

    Returns:
        (needs_rerender, reasons): 재렌더링이 필요한지 여부와 이유 목록
    """
    reasons = []

    md_content = getattr(instance, md_field, '')
    html_content = getattr(instance, html_field, '')

    # 1. text_md가 있지만 text_html이 비어있는 경우
    if md_content and not html_content:
        reasons.append("HTML 콘텐츠가 비어있음")

    # 2. text_html 검증
    if html_content:
        has_issues, issues = validate_html(html_content)
        if has_issues:
            reasons.extend(issues)

    # 3. text_md를 다시 렌더링했을 때 현재 text_html과 다른 경우
    if md_content:
        new_html = markdown.parse_to_html(md_content)

        # 공백 차이를 무시하고 비교
        normalized_current = re.sub(r'\s+', ' ', html_content).strip()
        normalized_new = re.sub(r'\s+', ' ', new_html).strip()

        if normalized_current != normalized_new:
            reasons.append("렌더링 결과가 현재 HTML과 다름")

            # 재렌더링 수행
            if not dry_run:
                setattr(instance, html_field, new_html)
                instance.save(update_fields=[html_field])

    needs_rerender = len(reasons) > 0

    return needs_rerender, reasons


def process_model(model_class, model_name, md_field='text_md', html_field='text_html', dry_run=True):
    """
    특정 모델의 모든 인스턴스를 처리

    Args:
        model_class: 처리할 모델 클래스
        model_name: 모델 이름 (로깅용)
        md_field: 마크다운 필드 이름
        html_field: HTML 필드 이름
        dry_run: True면 실제 저장하지 않음

    Returns:
        (total, needs_rerender): 전체 개수와 재렌더링이 필요한 개수
    """
    print(f"\n{'='*80}")
    print(f"{model_name} 처리 중...")
    print(f"{'='*80}")

    instances = model_class.objects.all()
    total_count = instances.count()
    needs_rerender_count = 0

    print(f"총 {total_count}개의 {model_name}을(를) 검사합니다...\n")

    for i, instance in enumerate(instances, 1):
        try:
            needs_rerender, reasons = check_and_rerender(
                instance,
                md_field=md_field,
                html_field=html_field,
                dry_run=dry_run
            )

            if needs_rerender:
                needs_rerender_count += 1
                instance_id = getattr(instance, 'id', 'unknown')
                print(f"[{i}/{total_count}] {model_name} #{instance_id} - 재렌더링 필요")
                for reason in reasons:
                    print(f"  - {reason}")

                if not dry_run:
                    print(f"  ✓ 재렌더링 완료")
                else:
                    print(f"  ⚠ DRY-RUN: 변경사항이 저장되지 않았습니다")
                print()

        except Exception as e:
            print(f"[{i}/{total_count}] {model_name} 처리 실패: {e}\n")

    print(f"{model_name} 처리 완료:")
    print(f"  - 전체: {total_count}개")
    print(f"  - 재렌더링 필요: {needs_rerender_count}개")

    return total_count, needs_rerender_count


def main():
    parser = argparse.ArgumentParser(
        description='마크다운 헤딩 태그를 검증하고 필요시 재렌더링합니다.'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='실제 변경 없이 확인만 수행합니다 (기본값)'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='실제로 재렌더링을 수행합니다'
    )
    parser.add_argument(
        '--models',
        nargs='+',
        choices=['Comment', 'PostContent', 'Profile', 'Series', 'all'],
        default=['all'],
        help='처리할 모델을 지정합니다 (기본값: all)'
    )

    args = parser.parse_args()

    # --execute가 명시적으로 지정되지 않으면 dry-run 모드
    dry_run = not args.execute

    if dry_run:
        print("\n" + "="*80)
        print("DRY-RUN 모드: 실제 변경사항은 저장되지 않습니다")
        print("실제 변경을 수행하려면 --execute 플래그를 사용하세요")
        print("="*80)
    else:
        print("\n" + "="*80)
        print("⚠️  실행 모드: 변경사항이 데이터베이스에 저장됩니다")
        print("="*80)

    # 처리할 모델 결정
    models_to_process = args.models
    if 'all' in models_to_process:
        models_to_process = ['Comment', 'PostContent', 'Profile', 'Series']

    # 모델별 설정
    model_configs = {
        'Comment': (Comment, 'Comment', 'text_md', 'text_html'),
        'PostContent': (PostContent, 'PostContent', 'text_md', 'text_html'),
        'Profile': (Profile, 'Profile', 'about_md', 'about_html'),
        'Series': (Series, 'Series', 'text_md', 'text_html'),
    }

    total_all = 0
    needs_rerender_all = 0

    # 각 모델 처리
    for model_name in models_to_process:
        if model_name in model_configs:
            model_class, display_name, md_field, html_field = model_configs[model_name]
            total, needs_rerender = process_model(
                model_class,
                display_name,
                md_field=md_field,
                html_field=html_field,
                dry_run=dry_run
            )
            total_all += total
            needs_rerender_all += needs_rerender

    # 최종 요약
    print(f"\n{'='*80}")
    print("전체 처리 요약")
    print(f"{'='*80}")
    print(f"전체: {total_all}개")
    print(f"재렌더링 필요: {needs_rerender_all}개")

    if dry_run and needs_rerender_all > 0:
        print(f"\n실제 재렌더링을 수행하려면 다음 명령어를 실행하세요:")
        print(f"  python {os.path.basename(__file__)} --execute")
    elif not dry_run and needs_rerender_all > 0:
        print(f"\n✓ {needs_rerender_all}개의 항목이 성공적으로 재렌더링되었습니다")
    elif needs_rerender_all == 0:
        print(f"\n✓ 모든 항목이 정상적으로 렌더링되어 있습니다")


if __name__ == '__main__':
    main()
