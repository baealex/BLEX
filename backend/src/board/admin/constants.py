"""
Admin Constants
매직 넘버를 상수로 정의하여 중앙 관리
"""
from typing import Final

# Pagination
LIST_PER_PAGE_DEFAULT: Final[int] = 30
LIST_PER_PAGE_LARGE: Final[int] = 100

# Display limits
MAX_TAGS_DISPLAY: Final[int] = 3
CONTENT_PREVIEW_WORDS: Final[int] = 10
TITLE_TRUNCATE_WORDS: Final[int] = 10

# Image preview sizes
THUMBNAIL_SIZE: Final[tuple[str, str]] = ('60px', '60px')
AVATAR_SIZE: Final[tuple[str, str]] = ('80px', '80px')
COVER_MAX_WIDTH: Final[str] = '400px'

# Date formats
DATETIME_FORMAT_FULL: Final[str] = '%Y-%m-%d %H:%M:%S'
DATETIME_FORMAT_SHORT: Final[str] = '%Y-%m-%d %H:%M'
DATE_FORMAT: Final[str] = '%Y-%m-%d'

# Inline settings
INLINE_EXTRA_DEFAULT: Final[int] = 0
INLINE_MAX_NUM_ONE: Final[int] = 1

# Colors - Django admin CSS 변수 사용 (다크모드 자동 지원)
COLOR_PRIMARY: Final[str] = 'var(--link-fg, #447e9b)'
COLOR_SUCCESS: Final[str] = '#28a745'
COLOR_DANGER: Final[str] = 'var(--error-fg, #ba2121)'
COLOR_WARNING: Final[str] = '#856404'
COLOR_INFO: Final[str] = '#17a2b8'
COLOR_MUTED: Final[str] = 'var(--body-quiet-color, #666)'
COLOR_TEXT: Final[str] = 'var(--body-fg, #333)'
COLOR_BG: Final[str] = 'var(--body-bg, #fff)'
COLOR_DARKENED_BG: Final[str] = 'var(--darkened-bg, #f8f9fa)'
COLOR_BORDER: Final[str] = 'var(--border-color, #ccc)'
