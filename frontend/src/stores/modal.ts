import Store from 'badland';

export interface ModalStoreState {
    isOpenAuthGetModal: boolean;
    isOpenAccountCreateModal: boolean;
    isOpenAccountDeleteModal: boolean;
    isOpenArticlePublishModal: boolean;
    isOpenTwoFactorAuthGetModal: boolean;
    isOpenTwoFactorAuthSyncModal: boolean;
}

type ModalName = keyof ModalStoreState;

class ModalStore extends Store<ModalStoreState> {
    constructor() {
        super();
        this.state = {
            isOpenAuthGetModal: false,
            isOpenAccountCreateModal: false,
            isOpenAccountDeleteModal: false,
            isOpenArticlePublishModal: false,
            isOpenTwoFactorAuthGetModal: false,
            isOpenTwoFactorAuthSyncModal: false
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
