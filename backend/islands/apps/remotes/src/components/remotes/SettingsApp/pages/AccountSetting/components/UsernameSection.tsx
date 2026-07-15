import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

const usernameSchema = z.object({ username: z.string().min(3, '아이디는 3자 이상이어야 합니다.').max(30, '아이디는 30자 이내여야 합니다.') });

type UsernameFormInputs = z.infer<typeof usernameSchema>;

interface UsernameSectionProps {
    initialUsername: string;
    isLoading: boolean;
    onSubmit: (username: string) => Promise<AccountFormSubmitResult>;
}

const UsernameSection = ({ initialUsername, isLoading, onSubmit }: UsernameSectionProps) => {
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isDirty, isValid }
    } = useForm<UsernameFormInputs>({
        resolver: zodResolver(usernameSchema),
        defaultValues: { username: initialUsername },
        mode: 'onChange'
    });

    useEffect(() => {
        reset({ username: initialUsername });
    }, [initialUsername, reset]);

    const handleFormSubmit = async (formData: UsernameFormInputs) => {
        const result = await onSubmit(formData.username);

        if (result.success) {
            reset(formData);
        } else if (result.error) {
            setError('username', {
                type: 'server',
                message: result.error
            });
        }
    };

    return (
        <form
            aria-label="사용자 필명 변경"
            className="pb-6"
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Input
                density="compact"
                type="text"
                label="사용자 필명"
                placeholder="사용자 필명"
                maxLength={30}
                helperText="로그인과 주소(URL)에 사용됩니다. 포스트가 있으면 6개월에 한 번만 변경할 수 있습니다."
                error={errors.username?.message}
                {...register('username')}
            />
            <div className="mt-4 flex justify-end">
                <Button
                    density="compact"
                    type="submit"
                    variant="primary"
                    size="md"
                    className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                    disabled={!isDirty || !isValid}
                    isLoading={isLoading}
                    leftIcon={!isLoading ? <Save className="h-4 w-4" /> : undefined}>
                    {isLoading ? '업데이트 중...' : '필명 업데이트'}
                </Button>
            </div>
        </form>
    );
};

export default UsernameSection;
