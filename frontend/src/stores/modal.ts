import BState from 'bstate';

export interface ModalStoreState {
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isSignoutModalOpen: boolean;
    isPublishModalOpen: boolean;
    isTelegramSyncModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean;
    isTwoFactorAuthSyncModalOpen: boolean;
}

type ModalName = keyof ModalStoreState;

class ModalStore extends BState<ModalStoreState> {
    constructor() {
        super();
        this.state = {
            isLoginModalOpen: false,
            isSignupModalOpen: false,
            isSignoutModalOpen: false,
            isPublishModalOpen: false,
            isTelegramSyncModalOpen: false,
            isTwoFactorAuthModalOpen: false,
            isTwoFactorAuthSyncModalOpen: false,
        }
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

export const modalStore = new ModalStore();