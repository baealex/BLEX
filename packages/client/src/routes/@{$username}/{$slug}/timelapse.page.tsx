import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';
import { h as h1 } from '~/features/discovery/view-helpers';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage({
    username,
    slug,
    title,
    totalCount,
    frames: timelapseFrames
}: PageProps['@{$username}/{$slug}/timelapse']): string {
    const postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
    const frames = timelapseFrames.map((frame, index) =>
        h1(
            'details',
            {
                className: 'frame',
                key: `${frame.savedAt}:${index}`,
                open: index === timelapseFrames.length - 1
            },
            h1(
                'summary',
                null,
                h1('strong', null, frame.title || '제목 없는 글'),
                h1('span', null, `${frame.stage === 'draft' ? '임시 저장' : '발행 글'} · ${frame.savedLabel}`)
            ),
            h1(
                'div',
                { className: 'frame-body' },
                h1('div', { dangerouslySetInnerHTML: { __html: frame.contentHtml } })
            )
        )
    );
    return renderApplicationDocument(
        h1(
            'html',
            { lang: 'ko' },
            h1(
                'head',
                null,
                h1('meta', { charSet: 'utf-8' }),
                h1('meta', {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1'
                }),
                h1('meta', {
                    name: 'color-scheme',
                    content: 'light dark'
                }),
                h1('meta', {
                    name: 'robots',
                    content: 'noindex,nofollow'
                }),
                h1('title', null, `작성 타임라인 · ${title} · BLEX`),
                h1('style', null, historyPageCss)
            ),
            h1(
                'body',
                null,
                h1(
                    'header',
                    null,
                    h1('a', { href: `${postPath}/edit` }, '글 편집'),
                    h1(
                        'nav',
                        null,
                        h1('a', { href: `${postPath}/revisions` }, '수정 기록'),
                        h1('a', { href: '/settings/posts' }, '글 관리')
                    )
                ),
                h1(
                    'main',
                    null,
                    h1('h1', null, '작성 타임라인'),
                    h1('p', { className: 'meta' }, `${title} · ${totalCount}개 장면`),
                    totalCount > timelapseFrames.length
                        ? h1(
                              'p',
                              { className: 'notice' },
                              `오래된 기록을 포함해 ${totalCount}개 중 ${timelapseFrames.length}개 장면을 표시합니다.`
                          )
                        : null,
                    frames.length
                        ? h1('section', { 'aria-label': '작성 기록 목록' }, ...frames)
                        : h1('p', { className: 'empty' }, '표시할 작성 기록이 없습니다.')
                )
            )
        )
    );
}
