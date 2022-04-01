import {
    Card,
    Modal,
} from '@design-system';

import * as API from '@modules/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    forms?: API.GetSettingFormsDataForms[];
    onFetch: (id: number) => void;
}

export function FormsModal(props: Props) {
    const {
        forms = []
    } = props;

    return (
        <Modal
            title="서식"
            isOpen={props.isOpen}
            onClose={props.onClose}
        >
            <>
                {forms.map((item, idx) => (
                    <Card key={idx} hasShadow isRounded className="p-3 mb-3">
                        <div className="d-flex justify-content-between">
                            <span onClick={() => props.onFetch(item.id)} className="c-pointer">
                                {item.title}
                            </span>
                        </div>
                    </Card>
                ))}
            </>
        </Modal>
    );
}