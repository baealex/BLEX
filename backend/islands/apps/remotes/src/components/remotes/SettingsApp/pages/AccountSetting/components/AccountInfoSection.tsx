import { BadgeInfo } from '@blex/ui/icons';
import { Card } from '~/components/shared';

interface AccountInfoSectionProps {
    createdDate: string;
    email: string;
}

const AccountInfoSection = ({ createdDate, email }: AccountInfoSectionProps) => {
    return (
        <Card
            title="계정 정보"
            icon={<BadgeInfo className="h-5 w-5" />}
            className="mb-6">
            <dl className="divide-y divide-line">
                <div className="grid gap-1 pb-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <dt className="text-sm font-medium text-content-secondary">가입일</dt>
                    <dd className="text-sm text-content sm:text-right">{createdDate}</dd>
                </div>
                <div className="grid gap-1 pt-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4">
                    <dt className="text-sm font-medium text-content-secondary">이메일</dt>
                    <dd className="break-all text-sm text-content sm:text-right">{email}</dd>
                </div>
            </dl>
        </Card>
    );
};

export default AccountInfoSection;
