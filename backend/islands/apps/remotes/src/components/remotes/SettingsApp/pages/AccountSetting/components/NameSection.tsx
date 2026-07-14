import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

const nameSchema = z.object({ name: z.string().max(30, '이름은 30자 이내여야 합니다.').optional() });

type NameFormInputs = z.infer<typeof nameSchema>;

interface NameSectionProps {
    initialName: string;
    isLoading: boolean;
    onSubmit: (name: string) => Promise<AccountFormSubmitResult>;
}

const NameSection = ({ initialName, isLoading, onSubmit }: NameSectionProps) => {
    const {
        register,
        handleSubmit,
        reset,
        setError,
        formState: { errors, isDirty, isValid }
    } = useForm<NameFormInputs>({
        resolver: zodResolver(nameSchema),
        defaultValues: { name: initialName },
        mode: 'onChange'
    });

    useEffect(() => {
        reset({ name: initialName });
    }, [initialName, reset]);

    const handleFormSubmit = async (formData: NameFormInputs) => {
        const result = await onSubmit(formData.name || '');

        if (result.success) {
            reset(formData);
        } else if (result.error) {
            setError('name', {
                type: 'server',
                message: result.error
            });
        }
    };

    return (
        <form
            aria-label="사용자 이름 변경"
            className="pt-6"
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Input
                type="text"
                label="사용자 이름"
                placeholder="사용자 이름"
                maxLength={30}
                error={errors.name?.message}
                {...register('name')}
            />
            <div className="mt-4 flex justify-end">
                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!isDirty || !isValid}
                    isLoading={isLoading}
                    leftIcon={!isLoading ? <Save className="h-4 w-4" /> : undefined}>
                    {isLoading ? '업데이트 중...' : '이름 업데이트'}
                </Button>
            </div>
        </form>
    );
};

export default NameSection;
