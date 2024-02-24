import type { Meta, StoryObj } from '@storybook/react';

import { KeywordInput } from './index';

const meta: Meta<typeof KeywordInput> = {
    title: 'DesignSystem/Forms/KeywordInput',
    component: KeywordInput,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof KeywordInput>;

export const Default: Story = {
    args: {
        value: 'keyword1, keyword2, keyword3, keyword1',
        onChange: () => 'onChange'
    }
};