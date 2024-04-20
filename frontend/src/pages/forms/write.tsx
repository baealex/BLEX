import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { Button, Container, Text } from '@design-system';
import { EditorContent, EditorTitle } from '@system-design/article-editor-page';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useHidePrimaryButton } from '~/hooks/use-hide-primary-button';
import { useState } from 'react';

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const { cookie } = req.headers;

    const { data } = await API.getLogin({
        'Cookie': cookie || ''
    });

    if (data.status !== 'DONE') {
        return { notFound: true };
    }

    return { props: { username: data.body.username } };
};

export default function UserFormEdit() {
    const router = useRouter();
    useHidePrimaryButton();

    const [state, setState] = useState<API.UserFormModel>({
        title: '',
        content: ''
    });

    const handleSubmitUserForm = async () => {
        if (state.title === '') {
            snackBar(message('BEFORE_REQ_ERR', '제목을 입력해주세요.'));
            return;
        }
        if (state.content === '') {
            snackBar(message('BEFORE_REQ_ERR', '내용을 입력해주세요.'));
            return;
        }
        const { data: responseData } = await API.createUserForm(state);
        if (responseData.status === 'DONE') {
            snackBar(message('AFTER_REQ_DONE', '서식이 생성되었습니다.'));
            router.push(`/forms/${responseData.body.id}/edit`);
        }
    };

    return (
        <Container size="sm">
            <Link className="shallow-dark" href="/setting/forms">
                <Text className="mb-3">
                    <i className="fas fa-angle-left ml-1" /> 서식 목록
                </Text>
            </Link>
            <EditorTitle
                disabledImage
                value={state.title}
                onChange={(title) => setState((prev) => ({
                    ...prev,
                    title
                }))}
            />
            <EditorContent
                value={state.content}
                onChange={(content) => setState((prev) => ({
                    ...prev,
                    content
                }))}
            />
            <Button display="block" className="mb-5" onClick={handleSubmitUserForm}>
                서식 생성
            </Button>
        </Container>
    );
}
