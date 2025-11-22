import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Card } from '~/components/shared';

const nameSchema = z.object({ name: z.string().max(30, '이름은 30자 이내여야 합니다.').optional() });

type NameFormInputs = z.infer<typeof nameSchema>;

interface NameSectionProps {
    initialName: string;
    isLoading: boolean;
    onSubmit: (name: string) => Promise<void>;
}

const NameSection = ({ initialName, isLoading, onSubmit }: NameSectionProps) => {
    const { register, handleSubmit, formState: { errors } } = useForm<NameFormInputs>({
        resolver: zodResolver(nameSchema),
        defaultValues: { name: initialName }
    });

    const handleFormSubmit = async (formData: NameFormInputs) => {
        await onSubmit(formData.name || '');
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
            <Card
                title="사용자 이름"
                icon={
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                }
                className="mb-6">
                <div className="mb-4">
                    <Input
                        type="text"
                        placeholder="사용자 실명"
                        maxLength={30}
                        error={errors.name?.message}
                        {...register('name')}
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
                    {isLoading ? '업데이트 중...' : '이름 업데이트'}
                </Button>
            </Card>
        </form>
    );
};

export default NameSection;
