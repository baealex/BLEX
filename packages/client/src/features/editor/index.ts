import { createElement, type ComponentProps } from 'react';
import { ConfirmProvider } from '~/contexts/ConfirmContext';
import PostEditor from './PostEditor';

const PostEditorWithConfirm = (props: ComponentProps<typeof PostEditor>) =>
    createElement(ConfirmProvider, null, createElement(PostEditor, props));

export default PostEditorWithConfirm;
