import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

import CheckBox from '@components/form/CheckBox';

interface Props {
    isOpen: boolean;
    close: Function;
    token: string;
    isAutoSave: boolean;
    onCheckAutoSave: Function;
    tempPosts: TempPost[];
    onFecth: Function;
    onDelete: Function;
    onSave: Function;
}

interface TempPost {
    token: string;
    title: string;
    date: string;
}

export default function TempArticleModal(props: Props) {
    return (
        <Modal title='임시 저장된 글' isOpen={props.isOpen} close={() => props.close()}>
            <ModalContent>
                <>
                    {props.tempPosts.map((item, idx) => (
                        <div key={idx} className="blex-card p-3 mb-3 d-flex justify-content-between">
                            <span onClick={() => props.onFecth(item.token)} className={`c-pointer ${props.token == item.token ? 'deep-dark' : 'shallow-dark'}`}>
                                {item.title} <span className="vs">{item.date}전</span>
                            </span>
                            <a onClick={() => props.onDelete(item.token)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    ))}
                </>
                <div className="blex-card p-3 mb-3 d-flex justify-content-between">
                    <span onClick={() => props.onFecth('')} className={`c-pointer ${props.token == '' ? 'deep-dark' : 'shallow-dark'}`}>
                        새 글 쓰기
                    </span>
                </div>
                <CheckBox
                    label="포스트 자동 저장"
                    checked={props.isAutoSave}
                    onCheck={(checked: boolean) => props.onCheckAutoSave(checked)}
                />
            </ModalContent>
            <ModalButton text="현재 글 임시저장" onClick={() => props.onSave()}/>
        </Modal>
    );
}