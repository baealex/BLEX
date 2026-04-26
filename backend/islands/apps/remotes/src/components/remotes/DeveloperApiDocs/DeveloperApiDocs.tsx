import type { ReactNode } from 'react';
import { Button } from '~/components/shared';
import { toast } from '~/utils/toast';
import { ApiFieldTable } from './ApiFieldTable';
import { apiOperations, methodClassName } from './apiReference';

interface DeveloperApiDocsProps {
    operationId?: string;
}

const copyText = async (value: string) => {
    try {
        await navigator.clipboard.writeText(value);
        toast.success('복사되었습니다.');
    } catch {
        toast.error('복사에 실패했습니다.');
    }
};

const DocsHeader = ({
    title,
    description,
    action
}: {
    title: string;
    description: string;
    action?: ReactNode;
}) => (
    <div className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-start md:justify-between">
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-content-hint">Developer API</div>
            <h1 className="mt-2 text-2xl font-semibold text-content">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content-secondary">{description}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
    </div>
);

const AuthHeaderBlock = () => (
    <section className="space-y-3 border-t border-line pt-6">
        <div>
            <h2 className="text-sm font-semibold text-content">인증</h2>
            <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                모든 개발자 API 요청은 Bearer 토큰을 Authorization 헤더에 담아 보냅니다.
            </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-line px-4 py-3 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all font-mono text-xs text-content-secondary">
                Authorization: Bearer blex_pat_...
            </code>
            <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => copyText('Authorization: Bearer blex_pat_...')}
                leftIcon={<i className="fas fa-copy" />}>
                복사
            </Button>
        </div>
    </section>
);

const OperationList = () => (
    <div className="space-y-8">
        <DocsHeader
            title="개발자 API 문서"
            description="외부 도구에서 개인 토큰으로 글을 조회하고 관리할 때 필요한 요청과 응답 형식을 확인합니다."
            action={(
                <a href="/settings/developer-api">
                    <Button variant="secondary" size="sm" leftIcon={<i className="fas fa-key" />}>
                        토큰 관리
                    </Button>
                </a>
            )}
        />

        <AuthHeaderBlock />

        <section className="space-y-3 border-t border-line pt-6">
            <h2 className="text-sm font-semibold text-content">API 목록</h2>
            <div className="divide-y divide-line rounded-lg border border-line">
                {apiOperations.map((operation) => (
                    <a
                        key={operation.id}
                        href={`/docs/developer-api/${operation.id}`}
                        className="group block p-4 transition-colors duration-150 hover:bg-surface-subtle active:bg-surface-elevated">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold ${methodClassName(operation.method)}`}>
                                        {operation.method}
                                    </span>
                                    <code className="break-all font-mono text-sm font-semibold text-content">
                                        {operation.path}
                                    </code>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-content">{operation.summary}</p>
                                <p className="mt-1 text-xs leading-relaxed text-content-secondary">{operation.description}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary lg:justify-end">
                                <span className="rounded-md border border-line px-2 py-1 font-mono">scope: {operation.scope}</span>
                                <span className="rounded-md border border-line px-2 py-1 font-mono">{operation.successStatus}</span>
                                <i className="fas fa-chevron-right text-content-hint transition-transform duration-150 group-hover:translate-x-0.5" />
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    </div>
);

const OperationDetail = ({ operationId }: { operationId: string }) => {
    const operation = apiOperations.find((item) => item.id === operationId);

    if (!operation) {
        return (
            <div className="space-y-8">
                <DocsHeader
                    title="API 문서"
                    description="요청한 API 문서를 찾을 수 없습니다."
                    action={(
                        <a href="/docs/developer-api">
                            <Button variant="secondary" size="sm" leftIcon={<i className="fas fa-arrow-left" />}>
                                목록
                            </Button>
                        </a>
                    )}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <DocsHeader
                title={operation.summary}
                description={operation.description}
                action={(
                    <a href="/docs/developer-api">
                        <Button variant="secondary" size="sm" leftIcon={<i className="fas fa-arrow-left" />}>
                            목록
                        </Button>
                    </a>
                )}
            />

            <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-md border px-2 py-1 font-mono text-xs font-semibold ${methodClassName(operation.method)}`}>
                        {operation.method}
                    </span>
                    <code className="break-all font-mono text-base font-semibold text-content">
                        {operation.path}
                    </code>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-content-secondary">
                    <span className="rounded-md border border-line px-2 py-1 font-mono">scope: {operation.scope}</span>
                    <span className="rounded-md border border-line px-2 py-1 font-mono">success: {operation.successStatus}</span>
                </div>
            </section>

            <AuthHeaderBlock />

            {operation.pathParams && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Path Parameters</h2>
                    <ApiFieldTable fields={operation.pathParams} />
                </section>
            )}

            {operation.queryParams && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Query Parameters</h2>
                    <ApiFieldTable fields={operation.queryParams} />
                </section>
            )}

            {operation.requestBody && (
                <section className="space-y-3 border-t border-line pt-6">
                    <h2 className="text-sm font-semibold text-content">Request Body</h2>
                    <ApiFieldTable fields={operation.requestBody} />
                </section>
            )}

            <section className="space-y-3 border-t border-line pt-6">
                <h2 className="text-sm font-semibold text-content">Response Body</h2>
                <ApiFieldTable fields={operation.responseBody} />
            </section>

            <section className="space-y-3 border-t border-line pt-6">
                <h2 className="text-sm font-semibold text-content">Errors</h2>
                <div className="divide-y divide-line rounded-lg border border-line">
                    {operation.errors.map((error) => (
                        <code key={error} className="block break-all px-4 py-3 font-mono text-xs text-content-secondary">
                            {error}
                        </code>
                    ))}
                </div>
            </section>

            {operation.example && (
                <section className="space-y-3 border-t border-line pt-6">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-content">{operation.example.title}</h2>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => copyText(operation.example?.code || '')}
                            leftIcon={<i className="fas fa-copy" />}>
                            복사
                        </Button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-line p-4 text-xs leading-relaxed text-content-secondary"><code>{operation.example.code}</code></pre>
                </section>
            )}
        </div>
    );
};

const DeveloperApiDocs = ({ operationId = '' }: DeveloperApiDocsProps) => (
    operationId ? <OperationDetail operationId={operationId} /> : <OperationList />
);

export default DeveloperApiDocs;
