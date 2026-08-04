import { useState } from 'react';
import { Input } from '@blex/ui/input';
import { Modal } from '@blex/ui/modal';
import { useEditorI18n } from '../../i18n';

interface YoutubeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (id: string) => void;
}

const YoutubeModal = ({ isOpen, onClose, onUpload }: YoutubeModalProps) => {
    const { t } = useEditorI18n();
    const [youtubeId, setYoutubeId] = useState('');

    const handleUpload = () => {
        if (youtubeId) {
            onUpload(youtubeId);
            setYoutubeId('');
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('youtube.title')} maxWidth="md">
            <Modal.Body>
                <div className="mb-4">
                    <Input
                        id="youtube-id"
                        label={t('youtube.label')}
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
                        placeholder={t('youtube.placeholder')}
                    />
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Modal.FooterAction variant="secondary" onClick={onClose}>
                    {t('youtube.cancel')}
                </Modal.FooterAction>
                <Modal.FooterAction variant="primary" onClick={handleUpload} disabled={!youtubeId}>
                    {t('youtube.add')}
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};

export default YoutubeModal;
