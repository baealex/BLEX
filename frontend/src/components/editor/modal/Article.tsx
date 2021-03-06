import { Card } from '@components/atoms';
import {
    Modal,
    Toggle,
} from '@components/integrated';

import * as API from '@modules/api';

interface Props {
    isOpen: boolean;
    close: Function;
    token: string;
    isAutoSave: boolean;
    onCheckAutoSave: Function;
    tempPosts: API.GetTempPostsDataTemp[];
    onFecth: Function;
    onDelete: Function;
    onSave: Function;
}

export default function TempArticleModal(props: Props) {
    return (
        <Modal
            title="임시 저장된 글"
            isOpen={props.isOpen}
            onClose={() => props.close()}
            submitText="현재 글 임시저장"
            onSubmit={() => props.onSave()}
        >
            <>
                {props.tempPosts.map((item, idx) => (
                    <Card isRounded className="p-3 mb-3">
                        <div key={idx} className="d-flex justify-content-between">
                            <span onClick={() => props.onFecth(item.token)} className={`c-pointer ${props.token == item.token ? 'deep-dark' : 'shallow-dark'}`}>
                                {item.title} <span className="vs">{item.createdDate}전</span>
                            </span>
                            <a onClick={() => props.onDelete(item.token)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    </Card>
                ))}
            </>
            <Card isRounded className="p-3 mb-3">
                <div className="d-flex justify-content-between">
                    <span onClick={() => props.onFecth('')} className={`c-pointer ${props.token == '' ? 'deep-dark' : 'shallow-dark'}`}>
                        새 글 쓰기
                    </span>
                </div>
            </Card>
            <Toggle
                label="포스트 자동 저장"
                defaultChecked={props.isAutoSave}
                onClick={(checked: boolean) => props.onCheckAutoSave(checked)}
            />
        </Modal>
    );
}