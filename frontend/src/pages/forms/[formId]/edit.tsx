import { useRouter } from 'next/router';

import { EditorContent, EditorTitle } from '@system-design/article-editor-page';
import { Button } from '@design-system';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useFetch } from '~/hooks/use-fetch';
import { useHidePrimaryButton } from '~/hooks/use-hide-primary-button';

export default function UserFormEdit() {
    const router = useRouter();
    useHidePrimaryButton();

    const { data, mutate } = useFetch(['forms', router.query.formId], async () => {
        if (router.query.formId) {
            const { data } = await API.getUserForm(Number(router.query.formId));
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                router.push('/');
            }
            return data.body;
        }
    });

    const handleUpdateUserForm = async () => {
        if (data) {
            const { data: responseData } = await API.updateUserForm(Number(router.query.formId), data);
            if (responseData.status === 'DONE') {
                snackBar(message('AFTER_REQ_DONE', '서식이 수정되었습니다.'));
            }
        }
    };

    if (!data) return null;

    return (
        <div className="x-container mb-5">
            <EditorTitle
                disabledImage
                value={data.title}
                onChange={(title) => mutate({
                    ...data,
                    title
                })}
            />
            <EditorContent
                value={data.content}
                onChange={(content) => mutate({
                    ...data,
                    content
                })}
            />
            <Button display="block" onClick={handleUpdateUserForm}>
                서식 업데이트
            </Button>
        </div>
    );
}
