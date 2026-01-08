import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Card, Alert } from '~/components/shared';

const passwordSchema = z.object({
    newPassword: z.string()
        .min(8, '비밀번호는 8자 이상이어야 합니다.')
        .regex(/[a-z]/, '비밀번호는 소문자를 포함해야 합니다.')
        .regex(/[A-Z]/, '비밀번호는 대문자를 포함해야 합니다.')
        .regex(/[0-9]/, '비밀번호는 숫자를 포함해야 합니다.')
        .regex(/[^a-zA-Z0-9]/, '비밀번호는 특수문자를 포함해야 합니다.'),
    confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['confirmPassword']
});

type PasswordFormInputs = z.infer<typeof passwordSchema>;

interface PasswordSectionProps {
    isLoading: boolean;
    onSubmit: (password: string) => Promise<void>;
}

const PasswordSection = ({ isLoading, onSubmit }: PasswordSectionProps) => {
    const { register, handleSubmit, reset, formState: { errors } } = useForm<PasswordFormInputs>({ resolver: zodResolver(passwordSchema) });

    const handleFormSubmit = async (formData: PasswordFormInputs) => {
        await onSubmit(formData.newPassword);
        reset({
 newPassword: '',
confirmPassword: ''
});
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <Card
                title="비밀번호 변경"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-6">
                <Alert variant="warning" className="mb-4">
                    비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                </Alert>
                <div className="mb-4">
                    <Input
                        label="새 비밀번호"
                        type="password"
                        placeholder="새 비밀번호"
                        maxLength={200}
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                </div>
                <div className="mb-6">
                    <Input
                        label="비밀번호 확인"
                        type="password"
                        placeholder="비밀번호 확인"
                        maxLength={200}
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
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
                    {isLoading ? '변경 중...' : '비밀번호 변경'}
                </Button>
            </Card>
        </form>
    );
};

export default PasswordSection;
