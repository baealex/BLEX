import { Card, Input } from '~/components/shared';

interface AccountInfoSectionProps {
    createdDate: string;
    email: string;
}

const AccountInfoSection = ({ createdDate, email }: AccountInfoSectionProps) => {
    return (
        <>
            {/* 가입일 */}
            <Card
                title="가입일"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-6">
                <Input
                    value={createdDate}
                    readOnly
                />
            </Card>

            {/* 이메일 */}
            <Card
                title="이메일"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                }
                className="mb-6">
                <Input
                    value={email}
                    readOnly
                />
            </Card>
        </>
    );
};

export default AccountInfoSection;
