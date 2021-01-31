import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

interface Props {
    isOpen: boolean;
    close: Function;
    onUpload: Function;
}

export default function TempArticleModal(props: Props) {
    return (
        <Modal title='이미지 업로드' isOpen={props.isOpen} close={() => props.close()}>
            <ModalContent>
                
            </ModalContent>
            <ModalButton text="업로드" onClick={() => props.onUpload()}/>
        </Modal>
    );
}