import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

interface UsernameFormInputs {
    username: string;
}

interface UsernameSectionProps {
    initialUsername: string;
    isLoading: boolean;
    onSubmit: (username: string) => Promise<AccountFormSubmitResult>;
}

const UsernameSection = ({ initialUsername, isLoading, onSubmit }: UsernameSectionProps) => {
    const { t } = useLingui();
    const usernameSchema = useMemo(() => z.object({
        username: z.string()
            .min(3, t({
                id: 'settings.account.username.validation.min_length',
                message: 'Username must be at least 3 characters.'
            }))
            .max(30, t({
                id: 'settings.account.username.validation.max_length',
                message: 'Username must be 30 characters or fewer.'
            }))
    }), [t]);
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
            aria-label={t({
                id: 'settings.account.username.form_label',
                message: 'Change username'
            })}
            className="pb-6"
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Input
                density="compact"
                type="text"
                label={t({
                    id: 'settings.account.username.label',
                    message: 'Username'
                })}
                placeholder={t({
                    id: 'settings.account.username.placeholder',
                    message: 'Username'
                })}
                maxLength={30}
                helperText={t({
                    id: 'settings.account.username.helper',
                    message: 'Used for sign-in and your URL. If you have published posts, you can change it only once every six months.'
                })}
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
                    {isLoading
                        ? t({
                            id: 'settings.account.username.updating',
                            message: 'Updating...'
                        })
                        : t({
                            id: 'settings.account.username.update',
                            message: 'Update username'
                        })}
                </Button>
            </div>
        </form>
    );
};

export default UsernameSection;
