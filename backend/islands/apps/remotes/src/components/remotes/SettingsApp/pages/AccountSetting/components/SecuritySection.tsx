import { AlertTriangle, ShieldCheck, Trash2 } from '@blex/ui/icons';
import { Button, Card } from '~/components/shared';

interface SecuritySectionProps {
    has2fa: boolean;
    onToggle2FA: (enable: boolean) => Promise<void>;
    onDeleteAccount: () => Promise<void>;
}

const SecuritySection = ({ has2fa, onToggle2FA, onDeleteAccount }: SecuritySectionProps) => {
    return (
        <>
            <Card
                title="보안 설정"
                icon={<ShieldCheck className="h-5 w-5" />}
                className="mb-6">
                <div className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="font-medium text-content">2차 인증</p>
                    </div>
                    <Button
                        density="compact"
                        variant="primary"
                        size="sm"
                        className="min-h-11! self-end [@media(pointer:fine)]:min-h-9! sm:self-auto"
                        onClick={() => onToggle2FA(!has2fa)}>
                        {has2fa ? '중지' : '활성화'}
                    </Button>
                </div>
            </Card>

            <section
                aria-labelledby="danger-zone-title"
                className="rounded-2xl border border-danger-line bg-danger-surface/40 p-6 md:p-8">
                <div className="flex items-center gap-3 text-danger">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 id="danger-zone-title" className="text-base font-semibold">
                        위험 영역
                    </h3>
                </div>
                <div className="mt-6 flex flex-col gap-4 border-t border-danger-line pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-medium text-content">계정 삭제</p>
                        <p className="text-sm text-content-secondary">모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.</p>
                    </div>
                    <Button
                        density="compact"
                        variant="danger"
                        size="sm"
                        className="min-h-11! shrink-0 self-end [@media(pointer:fine)]:min-h-9! sm:self-auto"
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        onClick={onDeleteAccount}>
                        삭제
                    </Button>
                </div>
            </section>
        </>
    );
};

export default SecuritySection;
