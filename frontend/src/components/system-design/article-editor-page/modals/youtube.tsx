import { useState } from 'react';

import { Modal } from '~/components/design-system';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (id: string) => void;
}

export function YoutubeModal(props: Props) {
    const [text, setText] = useState('');
    const [id, setId] = useState('');

    return (
        <Modal
            title="유튜브 영상"
            isOpen={props.isOpen}
            onClose={props.onClose}
            submitText="영상을 추가합니다"
            onSubmit={() => {
                props.onUpload(id);
                props.onClose();

                setText('');
                setId('');
            }}>
            <div className="input-group mb-3">
                <div className="input-group-prepend">
                    <span className="input-group-text">
                        영상링크
                    </span>
                </div>
                <input
                    type="text"
                    className="form-control"
                    maxLength={100}
                    value={text}
                    onChange={(e) => {
                        const { value } = e.target;
                        if (value === '') {
                            setId('');
                        }
                        else if (value.match(/https:\/\/youtu.be\/[\w-]{11}/)) {
                            setId(value.replace(/https:\/\/youtu.be\//, ''));
                        }
                        else if (value.match(/https:\/\/www.youtube.com\/watch\?v=[\w-]{11}/)) {
                            setId(value.replace(/https:\/\/www.youtube.com\/watch\?v=/, ''));
                        }
                        setText(value);
                    }}
                />
            </div>
            {id && (
                <iframe
                    width="100%"
                    height="315"
                    className="mt-3"
                    src={`https://www.youtube.com/embed/${id}`}
                />
            )}
        </Modal>
    );
}
