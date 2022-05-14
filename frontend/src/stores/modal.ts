import Store from 'badland';

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

class ModalStore extends Store<ModalStoreState> {
    constructor() {
        super();
        this.state = {
            isLoginModalOpen: false,
            isSignupModalOpen: false,
            isSignoutModalOpen: false,
            isPublishModalOpen: false,
            isTelegramSyncModalOpen: false,
            isTwoFactorAuthModalOpen: false,
            isTwoFactorAuthSyncModalOpen: false
        };
    }

    async onOpenModal(modalName: ModalName) {
        await this.set((prevState) => ({
            ...prevState,
            [modalName]: true
        }));
    }

    async onCloseModal(modalName: ModalName) {
        await this.set((prevState) => ({
            ...prevState,
            [modalName]: false
        }));
    }
}

export const modalStore = new ModalStore();