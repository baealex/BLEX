import type { ComponentProps } from 'react';
import { ConfirmProvider } from '~/contexts/ConfirmContext';
import PostEditor from './PostEditor';

const PostEditorWithConfirm = (props: ComponentProps<typeof PostEditor>) => (
    <ConfirmProvider>
        <PostEditor {...props} />
    </ConfirmProvider>
);

export default PostEditorWithConfirm;
