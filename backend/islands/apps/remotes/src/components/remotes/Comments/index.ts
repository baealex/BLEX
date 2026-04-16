import { createElement, type ComponentProps } from 'react';
import { ConfirmProvider } from '~/contexts/ConfirmContext';
import Comments from './Comments';

const CommentsWithConfirm = (props: ComponentProps<typeof Comments>) =>
    createElement(ConfirmProvider, null, createElement(Comments, props));

export default CommentsWithConfirm;
