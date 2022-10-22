import type { GetServerSideProps } from 'next';
import { useState } from 'react';

import { Button, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

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

const FormsSetting: PageComponent<Props> = (props) => {
    const [ title, setTitle ] = useState('');
    const [ content, setContent ] = useState('');
    const [ forms, setForms ] = useState(props.forms);

    const onSubmit = async () => {
        if (!title) {
            snackBar(message('BEFORE_REQ_ERR', '서식의 제목을 입력하세요.'));
            return;
        }
        if (!content) {
            snackBar(message('BEFORE_REQ_ERR', '서식의 내용을 입력하세요.'));
            return;
        }
        const { data } = await API.postForms(title, content);
        setForms([...forms, {
            id: data.body.id,
            title,
            createdDate: ''
        }]);
        snackBar(message('AFTER_REQ_DONE', '서식이 생성되었습니다.'));
        setTitle('');
        setContent('');
    };

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
            <input
                type="text"
                placeholder="서식의 제목"
                className="form-control mb-3"
                maxLength={50}
                onChange={(e) => setTitle(e.target.value)}
                value={title}
            />
            <textarea
                cols={40}
                rows={4}
                placeholder="서식의 내용을 입력하세요."
                className="form-control mb-3"
                onChange={(e) => setContent(e.target.value)}
                value={content}
            />
            <Button space="spare" display="block" onClick={onSubmit}>
                서식 등록
            </Button>
            <div className="mt-3">
                {forms.map((item, idx) => (
                    <Card key={idx} hasBackground isRounded className="p-3 mb-3">
                        <div className="d-flex justify-content-between">
                            <a className="deep-dark">
                                {item.title}
                            </a>
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
