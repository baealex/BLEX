import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

interface Props {
    isOpen: boolean;
    close: Function;
    onUpload: Function;
}

export default function YoutubeModal(props: Props) {
    return (
        <Modal title='유튜브 영상' isOpen={props.isOpen} close={() => props.close()}>
            <ModalContent>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">영상링크</span>
                    </div>
                    <input
                        type="text"
                        name="instagram"
                        className="form-control"
                        maxLength={100}
                        value={''}
                        onChange={(e) => {e}}
                    />
                </div>
            </ModalContent>
            <ModalButton text="추가" onClick={() => props.onUpload()}/>
        </Modal>
    );
}