import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

interface NameFormInputs {
    name?: string;
}

interface NameSectionProps {
    initialName: string;
    isLoading: boolean;
    onSubmit: (name: string) => Promise<AccountFormSubmitResult>;
}

const NameSection = ({ initialName, isLoading, onSubmit }: NameSectionProps) => {
    const { t } = useLingui();
    const nameSchema = useMemo(() => z.object({
        name: z.string().max(30, t({
            id: 'settings.account.name.validation.max_length',
            message: 'Name must be 30 characters or fewer.'
        })).optional()
    }), [t]);
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
            aria-label={t({
                id: 'settings.account.name.form_label',
                message: 'Change name'
            })}
            className="pt-6"
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Input
                density="compact"
                type="text"
                label={t({
                    id: 'settings.account.name.label',
                    message: 'Name'
                })}
                placeholder={t({
                    id: 'settings.account.name.placeholder',
                    message: 'Your name'
                })}
                maxLength={30}
                error={errors.name?.message}
                {...register('name')}
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
                    {isLoading
                        ? t({
                            id: 'settings.account.name.updating',
                            message: 'Updating...'
                        })
                        : t({
                            id: 'settings.account.name.update',
                            message: 'Update name'
                        })}
                </Button>
            </div>
        </form>
    );
};

export default NameSection;
