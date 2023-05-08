import type { Meta, StoryObj } from '@storybook/react';

import { Badge } from './index';

const meta: Meta<typeof Badge> = {
    title: 'DesignSystem/Atoms/Badge',
    component: Badge,
    tags: ['autodocs'],
    args: {
        children: 'Badge'
    }
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Rounded: Story = {
    args: {
        isRounded: true
    }
};
