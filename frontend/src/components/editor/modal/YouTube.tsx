import { useState } from 'react';

import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

interface Props {
    isOpen: boolean;
    close: Function;
    onUpload: Function;
}

export default function YoutubeModal(props: Props) {
    const [ text, setText ] = useState('');
    const [ id, setId ] = useState('');
    
    return (
        <Modal title='유튜브 영상' isOpen={props.isOpen} close={() => props.close()}>
            <ModalContent>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">영상링크</span>
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        maxLength={100}
                        value={text}
                        onChange={(e) => {
                            const { value } = e.target;
                            if(
                                !value.includes('https://www.youtube.com/watch?v=') &&
                                !value.includes('https://youtu.be/')) {
                                toast('😅 올바른 링크가 아닙니다.');
                                return;
                            }

                            setText(value);
                            const id = value
                                .replace('https://www.youtube.com/watch?v=', '')
                                .replace('https://youtu.be/', '');
                            setId(id);
                        }}
                    />
                    {id ? (
                        <iframe
                            width="100%"
                            height="315"
                            className="mt-3"
                            src={`https://www.youtube.com/embed/${id}`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : ''}
                </div>
            </ModalContent>
            <ModalButton text="추가" onClick={() => {
                props.onUpload(id);
                props.close();

                setText('');
                setId('');
            }}/>
        </Modal>
    );
}