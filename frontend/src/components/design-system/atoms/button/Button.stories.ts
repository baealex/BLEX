import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './index';

const meta: Meta<typeof Button> = {
    title: 'DesignSystem/Atoms/Button',
    component: Button,
    tags: ['autodocs'],
    args: {
        children: 'Button'
    }
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
    args: {
        color: 'default'
    }
};
