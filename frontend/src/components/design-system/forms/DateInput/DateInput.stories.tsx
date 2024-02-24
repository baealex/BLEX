import type { Meta, StoryObj } from '@storybook/react';

import { DateInput } from './index';

const meta: Meta<typeof DateInput> = {
    title: 'DesignSystem/Forms/DateInput',
    component: DateInput,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof DateInput>;

export const Default: Story = {
    args: {
        selected: new Date(),
        onChange: (date: Date) => console.log(date)
    }
};

export const ShowTime: Story = {
    args: {
        showTime: true,
        selected: new Date(),
        onChange: (date: Date) => console.log(date)
    }
};
