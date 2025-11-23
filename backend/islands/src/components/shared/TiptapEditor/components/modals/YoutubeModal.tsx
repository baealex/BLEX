import React, { useState } from 'react';
import Modal from '~/components/shared/Modal';
import Button from '~/components/shared/Button';
import Input from '~/components/shared/Input';

interface YoutubeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (id: string) => void;
}

const YoutubeModal: React.FC<YoutubeModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [youtubeId, setYoutubeId] = useState('');

    const handleUpload = () => {
        if (youtubeId) {
            onUpload(youtubeId);
            setYoutubeId('');
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="YouTube 영상 추가" maxWidth="md">
            <div className="p-6">
                <div className="mb-4">
                    <Input
                        id="youtube-id"
                        label="YouTube 영상 ID 또는 URL"
                        type="text"
                        value={youtubeId}
                        onChange={(e) => {
                            let id = e.target.value;
                            if (id.includes('youtube.com') || id.includes('youtu.be')) {
                                const match = id.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                                if (match && match[1]) {
                                    id = match[1];
                                }
                            }
                            setYoutubeId(id);
                        }}
                        placeholder="dQw4w9WgXcQ 또는 https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        취소
                    </Button>
                    <Button variant="primary" onClick={handleUpload} disabled={!youtubeId}>
                        추가
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default YoutubeModal;