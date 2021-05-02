import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';

import * as API from '@modules/api';

interface Props {
    isOpen: boolean;
    close: Function;
    forms?: API.GetFormsDataForms[];
    onFetch: (id: number) => void;
}

export default function FormsModal(props: Props) {
    const {
        forms = []
    } = props;

    return (
        <Modal title='서식' isOpen={props.isOpen} close={() => props.close()}>
            <ModalContent>
                <>
                    {forms.map((item, idx) => (
                        <div key={idx} className="blex-card p-3 mb-3 d-flex justify-content-between">
                            <span onClick={() => props.onFetch(item.id)} className="c-pointer">
                                {item.title}
                            </span>
                        </div>
                    ))}
                </>
            </ModalContent>
        </Modal>
    );
}