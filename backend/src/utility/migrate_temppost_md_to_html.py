#!/usr/bin/env python3
import os
import sys
import django

# Django 환경 설정
sys.path.append('/Users/baealex/GitHub/BLEX/backend/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'main.settings')
django.setup()

from board.models import TempPosts
from modules import markdown


def migrate_temppost_md_to_html():
    """
    TempPosts의 text_md를 text_html로 변환하여 마이그레이션
    """
    temp_posts = TempPosts.objects.all()
    total_count = temp_posts.count()
    
    print(f"총 {total_count}개의 TempPost를 마이그레이션합니다...")
    
    updated_count = 0
    error_count = 0
    
    for i, temp_post in enumerate(temp_posts, 1):
        try:
            if temp_post.text_md:
                # markdown을 HTML로 변환
                html_content = markdown.parse_to_html(temp_post.text_md)
                
                # text_html 필드에 저장 (필드가 없다면 추가 필요)
                # 임시로 text_md를 HTML로 교체
                temp_post.text_md = html_content
                temp_post.save()
                
                updated_count += 1
                print(f"[{i}/{total_count}] TempPost {temp_post.token} 변환 완료")
            else:
                print(f"[{i}/{total_count}] TempPost {temp_post.token} 내용 없음, 건너뜀")
                
        except Exception as e:
            error_count += 1
            print(f"[{i}/{total_count}] TempPost {temp_post.token} 변환 실패: {e}")
    
    print(f"\n마이그레이션 완료!")
    print(f"- 성공: {updated_count}개")
    print(f"- 실패: {error_count}개")
    print(f"- 전체: {total_count}개")


if __name__ == '__main__':
    migrate_temppost_md_to_html()