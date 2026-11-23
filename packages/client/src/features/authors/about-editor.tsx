import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SiteIcon } from '../../appearance/icons.js';

const editLinkClass =
    'inline-flex items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content';

async function saveAbout(url: string, content: string) {
    const token = /(?:^|; )csrftoken=([^;]+)/.exec(document.cookie)?.[1] ?? '';
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: new URLSearchParams({ aboutMarkdown: content }),
            headers: {
                'X-CSRFToken': token,
                Accept: 'application/json'
            }
        });
        const data = (await response.json().catch(() => ({}))) as {
            status?: string;
            message?: string;
            aboutMarkdown?: string;
            aboutHtml?: string;
        };
        if (response.ok && data.status === 'success')
            return {
                ok: true as const,
                message: data.message ?? '소개글을 저장했습니다.',
                markdown: data.aboutMarkdown ?? '',
                html: data.aboutHtml ?? ''
            };
        return {
            ok: false as const,
            message: data.message ?? '소개글을 저장하지 못했습니다.'
        };
    } catch {
        return {
            ok: false as const,
            message: '네트워크 오류로 저장하지 못했습니다.'
        };
    }
}

export function AboutHeading() {
    return (
        <div className="mb-6">
            <h2 className="text-2xl font-bold text-content">소개</h2>
        </div>
    );
}

/** The inside of the owner's about section. `aboutHtml` is always the sanitized value from the server. */
export function AboutEditor({
    aboutHtml,
    aboutMarkdown,
    editPath
}: {
    aboutHtml: string;
    aboutMarkdown: string;
    editPath: string;
}) {
    const input = useRef<HTMLTextAreaElement>(null);
    const savedMarkdown = useRef(aboutMarkdown);
    const [html, setHtml] = useState(aboutHtml);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null);
    const hasContent = Boolean(html);

    useEffect(() => {
        if (editing) input.current?.focus();
    }, [editing]);

    const restoreDraft = () => {
        if (input.current) input.current.value = savedMarkdown.current;
        setNotice(null);
    };

    const save = () => {
        setSaving(true);
        void saveAbout(editPath, input.current?.value ?? '')
            .then((result) => {
                setNotice({ text: result.message, failed: !result.ok });
                if (!result.ok) return;
                savedMarkdown.current = result.markdown;
                if (input.current) input.current.value = result.markdown;
                setHtml(result.html.trim() ? result.html : '');
                setEditing(false);
            })
            .finally(() => setSaving(false));
    };

    const editLink = (label: string) => (
        <a
            href={editPath}
            data-about-edit=""
            className={editLinkClass}
            onClick={(event) => {
                event.preventDefault();
                restoreDraft();
                setEditing(true);
            }}
        >
            <SiteIcon name="edit" className="mr-2" />
            {label}
        </a>
    );

    return (
        <>
            <AboutHeading />
            <p
                data-about-message=""
                hidden={!notice?.text}
                className={`mb-4 text-sm${notice ? (notice.failed ? ' text-danger' : ' text-success') : ''}`}
            >
                {notice?.text}
            </p>
            <div
                data-about-content=""
                hidden={editing || !hasContent}
                className="prose blog-post-content"
                dangerouslySetInnerHTML={{ __html: html }}
            />
            <div
                data-about-empty=""
                hidden={editing || hasContent}
                className="rounded-2xl border border-dashed border-line bg-surface px-5 py-6"
            >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="min-w-0 text-sm font-semibold text-content">아직 소개가 없습니다</p>
                    {editLink('소개글 작성')}
                </div>
            </div>
            <div data-about-actions="" hidden={editing || !hasContent} className="mt-6">
                {editLink('소개글 수정')}
            </div>
            <div data-about-form="" hidden={!editing} className="rounded-2xl border border-line bg-surface p-4">
                <textarea
                    ref={input}
                    data-about-input=""
                    defaultValue={aboutMarkdown}
                    placeholder="소개글을 작성하세요"
                    aria-label="소개"
                    className="min-h-64 w-full resize-y rounded-xl border border-line bg-surface-subtle p-4 text-sm leading-relaxed text-content placeholder-content-hint focus:border-line-strong focus:outline-none focus:ring-2 focus:ring-line/10"
                />
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        data-about-cancel=""
                        disabled={saving}
                        onClick={() => {
                            restoreDraft();
                            setEditing(false);
                        }}
                        className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        data-about-save=""
                        disabled={saving}
                        onClick={save}
                        className="inline-flex items-center justify-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-content-inverted transition-colors hover:bg-action-hover disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </>
    );
}

/** The inside of the dedicated edit page. `draft` keeps text typed before this island loaded. */
export function AboutPageEditor({
    aboutMarkdown,
    saveUrl,
    returnPath,
    draft
}: {
    aboutMarkdown: string;
    saveUrl: string;
    returnPath: string;
    draft?: string;
}) {
    const input = useRef<HTMLTextAreaElement>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useLayoutEffect(() => {
        if (draft !== undefined && input.current && input.current.value !== draft) input.current.value = draft;
    }, [draft]);

    const save = () => {
        setSaving(true);
        void saveAbout(saveUrl, input.current?.value ?? '')
            .then((result) => {
                setMessage(result.message);
                if (result.ok) location.replace(returnPath);
            })
            .finally(() => setSaving(false));
    };

    return (
        <>
            <textarea
                ref={input}
                data-about-input=""
                defaultValue={aboutMarkdown}
                placeholder="마크다운으로 작성해 보세요."
                aria-label="소개"
                className="h-64 w-full rounded-lg border border-line p-4 focus:outline-none focus:ring-2 focus:ring-line-strong/70"
            />
            <button
                type="button"
                data-about-save=""
                disabled={saving}
                onClick={save}
                className="mt-4 rounded-lg bg-action px-6 py-3 text-content-inverted hover:bg-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong/70 focus:ring-offset-2 disabled:opacity-50"
            >
                {saving ? '저장 중...' : '저장'}
            </button>
            <div data-about-message="" hidden={!message} className="mt-4 text-sm">
                {message}
            </div>
        </>
    );
}
