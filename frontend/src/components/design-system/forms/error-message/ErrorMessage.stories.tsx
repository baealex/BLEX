import type { Meta, StoryObj } from '@storybook/react';

import { ErrorMessage } from './index';

const meta: Meta<typeof ErrorMessage> = {
    title: 'DesignSystem/Forms/ErrorMessage',
    component: ErrorMessage,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof ErrorMessage>;

export const Default: Story = {
    args: {
        children: '에러가 이렇게 표시됩니다.'
    }
};
