import { useForm } from 'react-hook-form';
import { KeyRound, Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

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
    onSubmit: (password: string) => Promise<AccountFormSubmitResult>;
}

const PasswordSection = ({ isLoading, onSubmit }: PasswordSectionProps) => {
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isDirty, isValid }
    } = useForm<PasswordFormInputs>({
        resolver: zodResolver(passwordSchema),
        defaultValues: {
            newPassword: '',
            confirmPassword: ''
        },
        mode: 'onChange'
    });

    const handleFormSubmit = async (formData: PasswordFormInputs) => {
        const result = await onSubmit(formData.newPassword);

        if (result.success) {
            reset();
        } else if (result.error) {
            setError('newPassword', {
                type: 'server',
                message: result.error
            });
        }
    };

    return (
        <form
            aria-label="비밀번호 변경"
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Card
                title="비밀번호 변경"
                icon={<KeyRound className="h-5 w-5" />}
                className="mb-6">
                <div className="mb-4">
                    <Input
                        label="새 비밀번호"
                        type="password"
                        placeholder="새 비밀번호"
                        maxLength={200}
                        helperText="8자 이상이며 소문자, 대문자, 숫자, 특수문자를 각각 포함해야 합니다."
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
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-full sm:w-auto"
                        disabled={!isDirty || !isValid}
                        isLoading={isLoading}
                        leftIcon={!isLoading ? <Save className="h-4 w-4" /> : undefined}>
                        {isLoading ? '변경 중...' : '비밀번호 변경'}
                    </Button>
                </div>
            </Card>
        </form>
    );
};

export default PasswordSection;
