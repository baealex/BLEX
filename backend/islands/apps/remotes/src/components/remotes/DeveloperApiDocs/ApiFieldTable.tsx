import type { ApiField, Requirement } from './apiReference';

const requirementClassName = (requirement: Requirement) => {
    if (requirement === '필수') return 'border-line bg-surface text-content';
    if (requirement === '조건부') return 'border-line bg-surface text-content-secondary';
    return 'border-line bg-surface text-content-hint';
};

export const ApiFieldTable = ({ fields, emptyText = '필드 없음' }: { fields?: ApiField[]; emptyText?: string }) => {
    if (!fields || fields.length === 0) {
        return (
            <div className="rounded-lg border border-line bg-surface-elevated px-3 py-2 text-xs text-content-secondary">
                {emptyText}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-surface-elevated text-content-secondary">
                    <tr>
                        <th className="px-3 py-2 font-semibold">필드</th>
                        <th className="px-3 py-2 font-semibold">타입</th>
                        <th className="px-3 py-2 font-semibold">필수</th>
                        <th className="px-3 py-2 font-semibold">설명</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface-subtle">
                    {fields.map((field) => (
                        <tr key={`${field.name}-${field.description}`}>
                            <td className="whitespace-nowrap px-3 py-2 font-mono font-semibold text-content">{field.name}</td>
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-content-secondary">{field.type}</td>
                            <td className="whitespace-nowrap px-3 py-2">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 font-semibold ${requirementClassName(field.requirement)}`}>
                                    {field.requirement}
                                </span>
                            </td>
                            <td className="min-w-[240px] px-3 py-2 leading-relaxed text-content-secondary">{field.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
