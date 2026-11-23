import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage({
    username,
    slug,
    title,
    totalCount,
    frames: timelapseFrames
}: PageProps['@{$username}/{$slug}/timelapse']): string {
    const postPath = `/@${encodeURIComponent(username)}/${encodeURIComponent(slug)}`;
    const frames = timelapseFrames.map((frame, index) => (
        <details className="frame" key={`${frame.savedAt}:${index}`} open={index === timelapseFrames.length - 1}>
            <summary>
                <strong>{frame.title || '제목 없는 글'}</strong>
                <span>{`${frame.stage === 'draft' ? '임시 저장' : '발행 글'} · ${frame.savedLabel}`}</span>
            </summary>
            <div className="frame-body">
                <div dangerouslySetInnerHTML={{ __html: frame.contentHtml }} />
            </div>
        </details>
    ));
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{`작성 타임라인 · ${title} · BLEX`}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <header>
                    <a href={`${postPath}/edit`}>글 편집</a>
                    <nav>
                        <a href={`${postPath}/revisions`}>수정 기록</a>
                        <a href="/settings/posts">글 관리</a>
                    </nav>
                </header>
                <main>
                    <h1>작성 타임라인</h1>
                    <p className="meta">{`${title} · ${totalCount}개 장면`}</p>
                    {totalCount > timelapseFrames.length ? (
                        <p className="notice">{`오래된 기록을 포함해 ${totalCount}개 중 ${timelapseFrames.length}개 장면을 표시합니다.`}</p>
                    ) : null}
                    {frames.length ? (
                        <section aria-label="작성 기록 목록">{frames}</section>
                    ) : (
                        <p className="empty">표시할 작성 기록이 없습니다.</p>
                    )}
                </main>
            </body>
        </html>
    );
}
