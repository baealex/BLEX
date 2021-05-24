import { GetServerSidePropsContext } from 'next';
import { useState } from 'react';
import { toast } from 'react-toastify';

import SettingLayout from '@components/setting/layout';

import * as API from '@modules/api';
import { Card } from '@components/atoms';

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

export default function Setting(props: Props) {
    const [ title, setTitle ] = useState('');
    const [ content, setContent ] = useState('');
    const [ forms, setForms ] = useState(props.forms);

    const onSubmit = async () => {
        if (!title) {
            toast('😅 서식의 제목을 입력하세요.');
            return;
        }
        if (!content) {
            toast('😅 서식의 내용을 입력하세요.');
            return;
        }
        const { data } = await API.postForms(title, content);
        setForms([...forms, {
            id: data.body.id,
            title,
            createdDate: '',
        }]);
        toast('😀 서식이 생성되었습니다.');
        setTitle('');
        setContent('');
    };

    const onDelete = async (id: number) => {
        if (confirm('😮 정말 이 서식을 삭제할까요?')) {
            const { data } = await API.deleteForms(id);
            if (data.status === 'DONE') {
                setForms(forms.filter(item => item.id !== id));
                toast('😀 서식이 삭제되었습니다.');
            }
        }
    }

    return (
        <>
            <SettingLayout tabname="forms">
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
                    <Card isRounded className="p-3 mb-3">
                        <div key={idx} className="d-flex justify-content-between">
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
            </SettingLayout>
        </>
    );
}