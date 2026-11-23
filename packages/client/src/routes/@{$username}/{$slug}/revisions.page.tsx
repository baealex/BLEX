import { renderApplicationDocument } from '~/application/document';
import type { PageProps } from '~/contracts/pages';
import { historyPageCss } from '~/features/posts/history-pages-parts';

export default function renderPage(model: PageProps['@{$username}/{$slug}/revisions']): string {
    const postPath = `/@${encodeURIComponent(model.username)}/${encodeURIComponent(model.slug)}`;
    const pagination =
        model.lastPage > 1 ? (
            <nav className="pager" aria-label="페이지 이동">
                {model.page > 1 ? <a href={`${postPath}/revisions?page=${model.page - 1}`}>이전</a> : null}
                <span>{`${model.page} / ${model.lastPage}`}</span>
                {model.page < model.lastPage ? <a href={`${postPath}/revisions?page=${model.page + 1}`}>다음</a> : null}
            </nav>
        ) : null;
    const rows = model.revisions.map((revision) => {
        const label =
            revision.changeType === 'restore'
                ? '복원 전 기록'
                : revision.changeType === 'legacy'
                  ? '이전 기록'
                  : '수정 전 기록';
        const revisionTitle = revision.title === '_NO_CHANGED_' ? '제목 기록 없음' : revision.title || '제목 없는 글';
        const revisionPath = `${postPath}/revisions/${revision.id}`;
        return (
            <details className="revision" key={revision.id}>
                <summary>
                    <strong>{revisionTitle}</strong>
                    <span>{`${label} · ${revision.savedLabel} · ${revision.actor ? `@${revision.actor}` : '작성자 없음'}`}</span>
                </summary>
                <div className="revision-body">
                    {revision.date ? (
                        <time className="meta" dateTime={revision.date}>
                            {revision.date}
                        </time>
                    ) : null}
                    {revision.contentExcerpt ? <p className="meta">{revision.contentExcerpt}</p> : null}
                    {revision.contentHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: revision.contentHtml }} />
                    ) : (
                        <p className="meta">이전 본문은 보관되지 않았습니다.</p>
                    )}
                    <div className="forms">
                        {revision.changeType !== 'legacy' ? (
                            <form method="post" action={`${revisionPath}/restore`}>
                                <input type="hidden" name="csrfmiddlewaretoken" value={model.csrfToken} />
                                <input type="hidden" name="expectedUpdatedDate" value={model.updatedDate} />
                                <button type="submit">이 기록으로 복원</button>
                            </form>
                        ) : null}
                        <form method="post" action={`${revisionPath}/delete`}>
                            <input type="hidden" name="csrfmiddlewaretoken" value={model.csrfToken} />
                            <input type="hidden" name="expectedUpdatedDate" value={model.updatedDate} />
                            <label>
                                <input type="checkbox" name="confirmDelete" value="yes" required={true} />
                                기록 삭제 확인
                            </label>
                            <button className="danger" type="submit">
                                기록 삭제
                            </button>
                        </form>
                    </div>
                </div>
            </details>
        );
    });
    return renderApplicationDocument(
        <html lang="ko">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light dark" />
                <meta name="robots" content="noindex,nofollow" />
                <title>{`수정 기록 · ${model.title} · BLEX`}</title>
                <style>{historyPageCss}</style>
            </head>
            <body>
                <header>
                    <a href={`${postPath}/edit`}>글 편집</a>
                    <nav>
                        <a href={`${postPath}/timelapse`}>작성 타임라인</a>
                        <a href="/settings/posts">글 관리</a>
                    </nav>
                </header>
                <main>
                    <h1>수정 기록</h1>
                    <p className="meta">{`${model.title} · ${model.totalCount}개 기록 · 무제한 보관`}</p>
                    {model.notice ? (
                        <p className="notice" role="status">
                            {model.notice}
                        </p>
                    ) : null}
                    {rows.length ? (
                        <section aria-label="수정 기록 목록">{rows}</section>
                    ) : (
                        <p className="empty">저장된 수정 기록이 없습니다.</p>
                    )}
                    {pagination}
                </main>
            </body>
        </html>
    );
}
