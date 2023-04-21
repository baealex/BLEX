import type { Meta, StoryObj } from '@storybook/react';

import { FormControl } from './index';

import { BaseInput } from '../base-input';
import { ErrorMessage } from '../error-message';
import { Label } from '../label';

const meta: Meta<typeof FormControl> = {
    title: 'DesignSystem/Forms/FormControl',
    component: FormControl,
    tags: ['autodocs'],
    args: {}
};

export default meta;
type Story = StoryObj<typeof FormControl>;

export const Default: Story = {
    args: {
        children: [
            <Label>이메일</Label>,
            <BaseInput tag="input" type="email" />
        ]
    }
};

export const Required: Story = {
    args: {
        required: true,
        children: [
            <Label>이메일</Label>,
            <BaseInput tag="input" type="email" />
        ]
    }
};

export const Invalid: Story = {
    args: {
        invalid: true,
        required: true,
        children: [
            <Label>이메일</Label>,
            <BaseInput tag="input" type="email" value="invalid text" />,
            <ErrorMessage>
                올바른 이메일 주소를 입력해주세요.
            </ErrorMessage>
        ]
    }
};
