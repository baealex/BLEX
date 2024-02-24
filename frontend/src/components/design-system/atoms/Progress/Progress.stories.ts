import type { Meta, StoryObj } from '@storybook/react';

import { Progress } from './index';

const meta: Meta<typeof Progress> = {
    title: 'DesignSystem/Atoms/Progress',
    component: Progress,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
    args: {
        type: 'bar',
        value: 50
    }
};

export const Timer: Story = {
    args: {
        type: 'timer',
        time: 5,
        isReady: true
    }
};

export const ReverseTimer: Story = {
    args: {
        type: 'timer',
        time: 5,
        isReady: true,
        isReversed: true
    }
};

export const RepeatTimer: Story = {
    args: {
        type: 'timer',
        time: 5,
        isReady: true,
        repeat: true
    }
};