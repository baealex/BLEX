import type { Meta, StoryObj } from '@storybook/react';

import { BaseInput } from './index';

const meta: Meta<typeof BaseInput> = {
    title: 'DesignSystem/Forms/BaseInput',
    component: BaseInput,
    tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof BaseInput>;

export const Default: Story = {
    args: {
        tag: 'input'
    }
};

export const Icon: Story = {
    args: {
        tag: 'input',
        icon: 'B'
    }
};

export const Textarea: Story = {
    args: {
        tag: 'textarea'
    }
};

export const Select: Story = {
    args: {
        tag: 'select',
        icon: 'choice',
        children: (
            <>
                <option value="">nothing</option>
                <option value="apple">apple</option>
                <option value="banana">banana</option>
                <option value="orange">orange</option>
            </>
        )
    }
};