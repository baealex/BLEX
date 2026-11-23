const korean = {
    Search: '검색',
    'Recent searches': '최근 검색',
    'Quick search results': '빠른 검색 결과',
    'No recent searches.': '최근 검색어가 없습니다.',
    'No quick search results.': '빠른 검색 결과가 없습니다.',
    'Searching…': '검색 중…',
    'Try again on the search page.': '검색 화면에서 다시 시도해 주세요.',
    'Switch to light mode': '라이트 모드로 전환',
    'Switch to dark mode': '다크 모드로 전환',
    'Work logs': '작업 일지',
    Profile: '프로필',
    Settings: '설정',
    'New post': '새 포스트',
    'Log out': '로그아웃',
    'Account menu': '계정 메뉴',
    'User menu': '사용자 메뉴',
    'Signed in as': '로그인한 계정',
    'Log in': '로그인',
    'Sign up': '회원가입',
    'Mobile menu': '모바일 메뉴',
    Notifications: '알림',
    Menu: '메뉴',
    Close: '닫기',
    'Site menu': '사이트 메뉴',
    'Site information': '사이트 정보'
} as const;

export type SiteLocale = 'ko' | 'en';
export function siteText(locale: SiteLocale, source: keyof typeof korean) {
    return locale === 'en' ? source : korean[source];
}
