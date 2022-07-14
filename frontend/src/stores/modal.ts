import Store from 'badland';

export interface ModalStoreState {
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isSignoutModalOpen: boolean;
    isPublishModalOpen: boolean;
    isTelegramSyncModalOpen: boolean;
    is2FAModalOpen: boolean;
    is2FASyncModalOpen: boolean;
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
            is2FAModalOpen: false,
            is2FASyncModalOpen: false
        };
    }

    async open(modalName: ModalName) {
        await this.set((prevState) => ({
            ...prevState,
            [modalName]: true
        }));
    }

    async close(modalName: ModalName) {
        await this.set((prevState) => ({
            ...prevState,
            [modalName]: false
        }));
    }
}

export const modalStore = new ModalStore();