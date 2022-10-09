import {
    Card,
    Modal,
    Toggle
} from '@design-system';

import * as API from '~/modules/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    isAutoSave: boolean;
    onCheckAutoSave: (checked: boolean) => void;
    tempPosts: API.GetTempPostsResponseData['temps'];
    onSave: () => void;
    onFetch: (token: string) => void;
    onDelete: (token: string) => void;
}

export function TempArticleModal(props: Props) {
    return (
        <Modal
            title="임시 저장된 글"
            isOpen={props.isOpen}
            onClose={props.onClose}
            footer={[
                <Toggle
                    label="자동 저장"
                    defaultChecked={props.isAutoSave}
                    onClick={(checked) => props.onCheckAutoSave(checked)}
                />
            ]}
            submitText="현재 글을 저장합니다"
            onSubmit={props.onSave}>
            {props.tempPosts.map((item, idx) => (
                <Card key={idx} hasShadow isRounded className="p-3 mb-3">
                    <div className="d-flex justify-content-between">
                        <span onClick={() => props.onFetch(item.token)} className={`c-pointer ${props.token == item.token ? 'deep-dark' : 'shallow-dark'}`}>
                            {item.title} <span className="vs">{item.createdDate} ago</span>
                        </span>
                        <a onClick={() => props.onDelete(item.token)}>
                            <i className="fas fa-times"></i>
                        </a>
                    </div>
                </Card>
            ))}
            <Card hasShadow isRounded className="p-3 mb-3">
                <div className="d-flex justify-content-between">
                    <span onClick={() => props.onFetch('')} className={`c-pointer ${props.token == '' ? 'deep-dark' : 'shallow-dark'}`}>
                        새 글 쓰기
                    </span>
                </div>
            </Card>
        </Modal>
    );
}