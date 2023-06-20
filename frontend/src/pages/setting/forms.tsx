import type { GetServerSideProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { Alert, Button, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

type Props = API.GetUserFormsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getUserForms({ 'Cookie': req.headers.cookie || '' });

    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return { props: data.body };
};

const FormsSetting: PageComponent<Props> = (props) => {
    const router = useRouter();
    const [forms, setForms] = useState(props.forms);

    const onDelete = async (id: number) => {
        if (confirm(message('CONFIRM', '정말 이 서식을 삭제할까요?'))) {
            const { data } = await API.deleteForms(id);
            if (data.status === 'DONE') {
                setForms(forms.filter(item => item.id !== id));
                snackBar(message('AFTER_REQ_DONE', '서식이 삭제되었습니다.'));
            }
        }
    };

    return (
        <>
            <Alert type="warning" className="mb-3">
                자주 사용하는 서식을 미리 만들어두면,
                글을 더 빠르게 작성할 수 있을거예요.
            </Alert>
            <Button isRounded space="spare" display="block" onClick={() => router.push('/forms/write')}>
                나만의 서식 만들기
            </Button>
            <div className="mt-3">
                {forms.map((item, idx) => (
                    <Card key={idx} hasBackground isRounded className="p-3 mb-3">
                        <div className="d-flex justify-content-between">
                            <Link className="deep-dark" href={`/forms/${item.id}/edit`}>
                                {item.title}
                            </Link>
                            <a onClick={() => onDelete(item.id)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    </Card>
                ))}
            </div>
        </>
    );
};

FormsSetting.pageLayout = (page) => (
    <SettingLayout active="forms">
        {page}
    </SettingLayout>
);

export default FormsSetting;
