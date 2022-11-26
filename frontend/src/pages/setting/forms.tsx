import { useCallback, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Link from 'next/link';

import { Button, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';
import { useForm } from '~/hooks/use-form';

interface Props {
    forms: {
        id: number;
        title: string;
        createdDate: string;
    }[];
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const { data } = await API.getSettingForms({ 'Cookie': req.headers.cookie || '' });

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

interface FormForm {
    title: string;
    content: string;
}

const FormsSetting: PageComponent<Props> = (props) => {
    const [ forms, setForms ] = useState(props.forms);

    const { register, reset, handleSubmit } = useForm<FormForm>();

    const onDelete = async (id: number) => {
        if (confirm(message('CONFIRM', '정말 이 서식을 삭제할까요?'))) {
            const { data } = await API.deleteForms(id);
            if (data.status === 'DONE') {
                setForms(forms.filter(item => item.id !== id));
                snackBar(message('AFTER_REQ_DONE', '서식이 삭제되었습니다.'));
            }
        }
    };

    const handleFormSubmit = useCallback(handleSubmit((async form => {
        if (form.title === '') {
            snackBar(message('BEFORE_REQ_ERR', '제목을 입력해주세요.'));
            return;
        }
        if (form.content === '') {
            snackBar(message('BEFORE_REQ_ERR', '내용을 입력해주세요.'));
            return;
        }
        const { data } = await API.createUserForm(form);
        setForms(forms => [...forms, {
            id: data.body.id,
            title: form.title,
            createdDate: ''
        }]);
        reset();
        snackBar(message('AFTER_REQ_DONE', '서식이 생성되었습니다.'));
    })), [handleSubmit]);

    return (
        <>
            <form onSubmit={handleFormSubmit}>
                <input
                    {...register('title')}
                    type="text"
                    placeholder="서식의 제목"
                    className="form-control mb-3"
                    maxLength={50}
                />
                <textarea
                    {...register('content')}
                    cols={40}
                    rows={4}
                    placeholder="서식의 내용을 입력하세요."
                    className="form-control mb-3"
                />
                <Button type="submit" space="spare" display="block">
                    서식 등록
                </Button>
            </form>
            <div className="mt-3">
                {forms.map((item, idx) => (
                    <Card key={idx} hasBackground isRounded className="p-3 mb-3">
                        <div className="d-flex justify-content-between">
                            <Link href={`/forms/${item.id}/edit`}>
                                <a className="deep-dark">
                                    {item.title}
                                </a>
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
