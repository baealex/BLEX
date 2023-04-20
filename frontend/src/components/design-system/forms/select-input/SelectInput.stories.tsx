import type { Meta, StoryObj } from '@storybook/react';

import { SelectInput } from './index';

const meta: Meta<typeof SelectInput> = {
    title: 'DesignSystem/Forms/SelectInput',
    component: SelectInput,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof SelectInput>;

export const Default: Story = {
    args: {
    }
};
