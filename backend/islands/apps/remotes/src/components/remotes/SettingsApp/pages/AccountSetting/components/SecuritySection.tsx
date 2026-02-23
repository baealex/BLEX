import { Button, Card } from '~/components/shared';

interface SecuritySectionProps {
    has2fa: boolean;
    onToggle2FA: (enable: boolean) => Promise<void>;
    onDeleteAccount: () => Promise<void>;
}

const SecuritySection = ({ has2fa, onToggle2FA, onDeleteAccount }: SecuritySectionProps) => {
    return (
        <Card
            title="보안 설정"
            icon={
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            }>
            <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-line">
                    <div>
                        <p className="font-medium text-content">2차 인증</p>
                        <p className="text-sm text-content-secondary">계정 보안을 강화합니다</p>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onToggle2FA(!has2fa)}>
                        {has2fa ? '중지' : '활성화'}
                    </Button>
                </div>
                <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-line">
                    <div>
                        <p className="font-medium text-content">계정 삭제</p>
                        <p className="text-sm text-content-secondary">모든 데이터가 영구적으로 삭제됩니다</p>
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={onDeleteAccount}>
                        삭제
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SecuritySection;
