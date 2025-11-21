import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Card, Alert } from '~/components/shared';

const usernameSchema = z.object({ username: z.string().min(3, '아이디는 3자 이상이어야 합니다.').max(30, '아이디는 30자 이내여야 합니다.') });

type UsernameFormInputs = z.infer<typeof usernameSchema>;

interface UsernameSectionProps {
    initialUsername: string;
    isLoading: boolean;
    onSubmit: (username: string) => Promise<void>;
}

const UsernameSection = ({ initialUsername, isLoading, onSubmit }: UsernameSectionProps) => {
    const { register, handleSubmit, formState: { errors } } = useForm<UsernameFormInputs>({
        resolver: zodResolver(usernameSchema),
        defaultValues: { username: initialUsername }
    });

    const handleFormSubmit = async (formData: UsernameFormInputs) => {
        await onSubmit(formData.username);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <Card
                title="사용자 필명"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-6">
                <Alert variant="warning" className="mb-4">
                    사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다. 작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                </Alert>
                <div className="mb-4">
                    <Input
                        type="text"
                        placeholder="사용자 필명"
                        maxLength={30}
                        error={errors.username?.message}
                        {...register('username')}
                    />
                </div>
                <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    isLoading={isLoading}
                    leftIcon={
                        !isLoading ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : undefined
                    }>
                    {isLoading ? '업데이트 중...' : '필명 업데이트'}
                </Button>
            </Card>
        </form>
    );
};

export default UsernameSection;
