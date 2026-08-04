import { useMemo } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { KeyRound, Save } from '@blex/ui/icons';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Input } from '~/components/shared';
import type { AccountFormSubmitResult } from '../types';

interface PasswordFormInputs {
    newPassword: string;
    confirmPassword: string;
}

interface PasswordSectionProps {
    isLoading: boolean;
    onSubmit: (password: string) => Promise<AccountFormSubmitResult>;
}

const PasswordSection = ({ isLoading, onSubmit }: PasswordSectionProps) => {
    const { t } = useLingui();
    const passwordSchema = useMemo(() => z.object({
        newPassword: z.string()
            .min(8, t({
                id: 'settings.account.password.validation.min_length',
                message: 'Password must be at least 8 characters.'
            }))
            .regex(/[a-z]/, t({
                id: 'settings.account.password.validation.lowercase',
                message: 'Password must include a lowercase letter.'
            }))
            .regex(/[A-Z]/, t({
                id: 'settings.account.password.validation.uppercase',
                message: 'Password must include an uppercase letter.'
            }))
            .regex(/[0-9]/, t({
                id: 'settings.account.password.validation.number',
                message: 'Password must include a number.'
            }))
            .regex(/[^a-zA-Z0-9]/, t({
                id: 'settings.account.password.validation.special',
                message: 'Password must include a special character.'
            })),
        confirmPassword: z.string()
    }).refine((data) => data.newPassword === data.confirmPassword, {
        message: t({
            id: 'settings.account.password.validation.mismatch',
            message: 'Passwords do not match.'
        }),
        path: ['confirmPassword']
    }), [t]);
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
            aria-label={t({
                id: 'settings.account.password.change',
                message: 'Change password'
            })}
            onSubmit={handleSubmit(handleFormSubmit)}>
            <Card
                title={t({
                    id: 'settings.account.password.change',
                    message: 'Change password'
                })}
                icon={<KeyRound className="h-5 w-5" />}
                className="mb-6">
                <div className="mb-4">
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.account.password.new',
                            message: 'New password'
                        })}
                        type="password"
                        placeholder={t({
                            id: 'settings.account.password.new',
                            message: 'New password'
                        })}
                        maxLength={200}
                        helperText={t({
                            id: 'settings.account.password.helper',
                            message: 'Use at least 8 characters, including lowercase and uppercase letters, a number, and a special character.'
                        })}
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                </div>
                <div className="mb-6">
                    <Input
                        density="compact"
                        label={t({
                            id: 'settings.account.password.confirm',
                            message: 'Confirm password'
                        })}
                        type="password"
                        placeholder={t({
                            id: 'settings.account.password.confirm',
                            message: 'Confirm password'
                        })}
                        maxLength={200}
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />
                </div>
                <div className="flex justify-end">
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
                                id: 'settings.account.password.changing',
                                message: 'Changing...'
                            })
                            : t({
                                id: 'settings.account.password.change',
                                message: 'Change password'
                            })}
                    </Button>
                </div>
            </Card>
        </form>
    );
};

export default PasswordSection;
