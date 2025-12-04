"""
링크 체커 서비스 - 깨진 내부 링크 찾기
"""
import os
import re
from typing import List, Dict, Any
from django.conf import settings

from board.models import Post, Comment, Profile, Series


class LinkCheckerService:
    """내부 링크 체커 서비스"""

    def __init__(self):
        self.media_root = settings.MEDIA_ROOT
        self.broken_links = []

    @staticmethod
    def extract_internal_links(text: str) -> List[str]:
        """텍스트에서 내부 이미지/링크 추출"""
        if not text:
            return []

        links = []

        # 마크다운 이미지: ![alt](url)
        image_pattern = re.compile(r'!\[.*?\]\(([^\s\)]*)\)')
        links.extend(image_pattern.findall(text))

        # 비디오/GIF: @gif[url]
        video_pattern = re.compile(r'@gif\[(.*?)\]')
        links.extend(video_pattern.findall(text))

        # HTML img src
        html_img_pattern = re.compile(r'<img[^>]+src=[\'"]([^\'"]+)[\'"]')
        links.extend(html_img_pattern.findall(text))

        # 내부 링크만 필터링 (/uploads/, /media/, /images/ 등으로 시작)
        internal_links = []
        for link in links:
            # 외부 링크 제외
            if link.startswith('http://') or link.startswith('https://'):
                # 단, /uploads, /media로 시작하는 외부 링크는 상대 경로로 변환
                if '/uploads/' in link or '/media/' in link or '/images/' in link:
                    # URL에서 경로만 추출
                    if '/uploads/' in link:
                        link = '/uploads/' + link.split('/uploads/')[-1]
                    elif '/media/' in link:
                        link = '/media/' + link.split('/media/')[-1]
                    elif '/images/' in link:
                        link = '/images/' + link.split('/images/')[-1]
                else:
                    continue

            # 상대 경로만
            if link.startswith('/') or link.startswith('images/') or link.startswith('uploads/'):
                internal_links.append(link)

        return internal_links

    def check_file_exists(self, link: str) -> bool:
        """파일이 실제로 존재하는지 확인"""
        # URL 디코딩
        from urllib.parse import unquote
        link = unquote(link)

        # 절대 경로로 변환
        if link.startswith('/media/'):
            file_path = os.path.join(self.media_root, link[7:])  # /media/ 제거
        elif link.startswith('/uploads/'):
            file_path = os.path.join(self.media_root, link[9:])  # /uploads/ 제거
        elif link.startswith('/images/'):
            file_path = os.path.join(self.media_root, link[1:])  # / 제거
        elif link.startswith('images/'):
            file_path = os.path.join(self.media_root, link)
        else:
            file_path = os.path.join(self.media_root, link.lstrip('/'))

        return os.path.exists(file_path)

    def check_posts(self) -> List[Dict[str, Any]]:
        """포스트의 깨진 링크 체크"""
        broken_links = []

        posts = Post.objects.select_related('content', 'author').all()

        for post in posts:
            if not hasattr(post, 'content') or not post.content:
                continue

            # 마크다운과 HTML 모두 체크
            text_md = post.content.text_md or ''
            text_html = post.content.text_html or ''

            links = set(self.extract_internal_links(text_md))
            links.update(self.extract_internal_links(text_html))

            # 타이틀 이미지도 체크
            if post.image:
                links.add(str(post.image))

            for link in links:
                if not self.check_file_exists(link):
                    broken_links.append({
                        'type': 'post',
                        'id': post.id,
                        'title': post.title,
                        'author': post.author.username,
                        'url': f'/posts/{post.url}',
                        'broken_link': link
                    })

        return broken_links

    def check_comments(self) -> List[Dict[str, Any]]:
        """댓글의 깨진 링크 체크"""
        broken_links = []

        comments = Comment.objects.select_related('author').all()

        for comment in comments:
            text = comment.text or ''
            links = set(self.extract_internal_links(text))

            for link in links:
                if not self.check_file_exists(link):
                    broken_links.append({
                        'type': 'comment',
                        'id': comment.pk,
                        'author': comment.author,
                        'broken_link': link
                    })

        return broken_links

    def check_profiles(self) -> List[Dict[str, Any]]:
        """프로필의 깨진 링크 체크"""
        broken_links = []

        profiles = Profile.objects.select_related('user').all()

        for profile in profiles:
            links = set()

            # 프로필 설명
            about_md = profile.about_md or ''
            about_html = profile.about_html or ''
            links.update(self.extract_internal_links(about_md))
            links.update(self.extract_internal_links(about_html))

            # 아바타 및 커버 이미지
            if profile.avatar:
                links.add(str(profile.avatar))
            if profile.cover:
                links.add(str(profile.cover))

            for link in links:
                if not self.check_file_exists(link):
                    broken_links.append({
                        'type': 'profile',
                        'username': profile.user.username,
                        'broken_link': link
                    })

        return broken_links

    def check_series(self) -> List[Dict[str, Any]]:
        """시리즈의 깨진 링크 체크"""
        broken_links = []

        series_list = Series.objects.select_related('owner').all()

        for series in series_list:
            text_md = series.text_md or ''
            text_html = series.text_html or ''

            links = set(self.extract_internal_links(text_md))
            links.update(self.extract_internal_links(text_html))

            for link in links:
                if not self.check_file_exists(link):
                    broken_links.append({
                        'type': 'series',
                        'name': series.name,
                        'owner': series.owner.username,
                        'broken_link': link
                    })

        return broken_links

    def check_all(self) -> Dict[str, Any]:
        """모든 컨텐츠의 깨진 링크 체크"""
        result = {
            'posts': self.check_posts(),
            'comments': self.check_comments(),
            'profiles': self.check_profiles(),
            'series': self.check_series(),
        }

        result['total_broken'] = (
            len(result['posts']) +
            len(result['comments']) +
            len(result['profiles']) +
            len(result['series'])
        )

        return result
