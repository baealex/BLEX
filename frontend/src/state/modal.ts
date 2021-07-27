import { ShareState } from './share-state';

export interface ModalState {
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean;
}

type ModalName = 'isLoginModalOpen' |  'isSignupModalOpen' | 'isTwoFactorAuthModalOpen';

class ModalContext extends ShareState<ModalState> {
    state = {
        isLoginModalOpen: false,
        isSignupModalOpen: false,
        isTwoFactorAuthModalOpen: false,
    }

    onOpenModal(modalName: ModalName) {
        this.setState(<any>{
            [modalName]: true
        });
    }

    onCloseModal(modalName: ModalName) {
        this.setState(<any>{
            [modalName]: false
        });
    }
}

export const modalContext = new ModalContext();