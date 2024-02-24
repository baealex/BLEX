import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { PopOver } from './index';

const meta: Meta<typeof PopOver> = {
    title: 'DesignSystem/Atoms/PopOver',
    component: PopOver,
    tags: ['autodocs'],
    args: {
        children: 'PopOver',
        text: '시간이 흘러가면서 천천히 잊혀져 가는 기억은 모두 사라져 내게 멀어진대도 영원한 건 너의 마음뿐'
    }
};

export default meta;

const Template: StoryFn<typeof PopOver> = (args) => (
    React.createElement('div', {
        style: {
            width: '100%',
            height: '50vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }
    }, React.createElement(PopOver, args))
);

export const Left = Template.bind({});

export const Right = Template.bind({});
Right.args = {
    position: 'right'
};

export const Top = Template.bind({});
Top.args = {
    position: 'top'
};

export const Bottom = Template.bind({});
Bottom.args = {
    position: 'bottom'
};