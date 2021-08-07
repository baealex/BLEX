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

    async onOpenModal(modalName: ModalName) {
        await this.setState(<any>{
            [modalName]: true
        });
    }

    async onCloseModal(modalName: ModalName) {
        await this.setState(<any>{
            [modalName]: false
        });
    }
}

export const modalContext = new ModalContext();