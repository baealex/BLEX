import Link from 'next/link';
import { useRouter } from 'next/router';

import { Button, Container, Text } from '@design-system';
import { EditorContent, EditorTitle } from '@system-design/article-editor-page';

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
            if (data.title === '') {
                snackBar(message('BEFORE_REQ_ERR', '제목을 입력해주세요.'));
                return;
            }
            if (data.content === '') {
                snackBar(message('BEFORE_REQ_ERR', '내용을 입력해주세요.'));
                return;
            }
            const { data: responseData } = await API.updateUserForm(Number(router.query.formId), data);
            if (responseData.status === 'DONE') {
                snackBar(message('AFTER_REQ_DONE', '서식이 수정되었습니다.'));
            }
        }
    };

    if (!data) return null;

    return (
        <Container size="sm">
            <Link className="shallow-dark" href="/setting/forms">
                <Text className="mb-3">
                    <i className="fas fa-angle-left ml-1" /> 서식 목록
                </Text>
            </Link>
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
            <Button display="block" className="mb-5" onClick={handleUpdateUserForm}>
                서식 업데이트
            </Button>
        </Container>
    );
}
