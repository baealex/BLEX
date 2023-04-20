import type { Meta, StoryObj } from '@storybook/react';

import { BaseInput } from './index';

const meta: Meta<typeof BaseInput> = {
    title: 'DesignSystem/Forms/BaseInput',
    component: BaseInput,
    tags: ['autodocs']
};

export default meta;
type Story = StoryObj<typeof BaseInput>;

export const Default: Story = {};
