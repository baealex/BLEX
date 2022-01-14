import { GetServerSidePropsContext } from 'next';
import { useState } from 'react';
import { snackBar } from '@modules/ui/snack-bar';

import { Card } from '@design-system';
import { Layout } from '@components/setting';

import * as API from '@modules/api';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { req, res } = context;
    if(!req.headers.cookie) {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    const { data } = await API.getSettingForms(req.headers.cookie);
    if(data.status === 'ERROR') {
        res.writeHead(302, { Location: '/' });
        res.end();
    }
    return {
        props: data.body
    };
}

interface Props {
    forms: {
        id: number;
        title: string;
        createdDate: string;
    }[];
};

export default function FormsSetting(props: Props) {
    const [ title, setTitle ] = useState('');
    const [ content, setContent ] = useState('');
    const [ forms, setForms ] = useState(props.forms);

    const onSubmit = async () => {
        if (!title) {
            snackBar('😅 서식의 제목을 입력하세요.');
            return;
        }
        if (!content) {
            snackBar('😅 서식의 내용을 입력하세요.');
            return;
        }
        const { data } = await API.postForms(title, content);
        setForms([...forms, {
            id: data.body.id,
            title,
            createdDate: '',
        }]);
        snackBar('😀 서식이 생성되었습니다.');
        setTitle('');
        setContent('');
    };

    const onDelete = async (id: number) => {
        if (confirm('😮 정말 이 서식을 삭제할까요?')) {
            const { data } = await API.deleteForms(id);
            if (data.status === 'DONE') {
                setForms(forms.filter(item => item.id !== id));
                snackBar('😀 서식이 삭제되었습니다.');
            }
        }
    }

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
            <button
                type="button"
                className="btn btn-block btn-dark"
                onClick={() => onSubmit()}>
                서식 등록
            </button>
            <div className="mt-3">
                {forms.map((item, idx) => (
                    <Card key={idx} hasShadow isRounded className="p-3 mb-3">
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
}

FormsSetting.pageLayout = (page: JSX.Element) => (
    <Layout tabname="forms">
        {page}
    </Layout>
)