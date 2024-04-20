import { Modal } from '~/components/design-system';

export interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
    return (
        <Modal title="도움말" isOpen={isOpen} onClose={onClose}>
            <p>
                도움말 내용
            </p>
        </Modal>
    );
}