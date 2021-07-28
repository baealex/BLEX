import SharedState from 'bstate';

export interface ModalContextState {
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean;
}

type ModalName = keyof ModalContextState;

class ModalContext extends SharedState<ModalContextState> {
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