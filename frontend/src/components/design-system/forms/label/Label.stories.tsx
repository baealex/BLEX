import type { Meta, StoryObj } from '@storybook/react';

import { Label } from './index';

const meta: Meta<typeof Label> = {
    title: 'DesignSystem/Forms/Label',
    component: Label,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
    args: {
        children: 'label'
    }
};

export const Required: Story = {
    args: {
        required: true,
        children: 'label'
    }
};
