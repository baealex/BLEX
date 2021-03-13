interface GlobalState {
    isLogin: boolean;
    username: string;
    isNightMode: boolean;
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isSettingModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean;
}

type ModalName = 'isSettingModalOpen' | 'isLoginModalOpen' |  'isSignupModalOpen' | 'isTwoFactorAuthModalOpen';

class Global {
    state: GlobalState;
    private updater: any;

    constructor() {
        this.state = {
            isLogin: false,
            username: '',
            isNightMode: false,
            isLoginModalOpen: false,
            isSignupModalOpen: false,
            isSettingModalOpen: false,
            isTwoFactorAuthModalOpen: false,
        }
        this.updater = {};
    }

    setState(newState: object) {
        Object.assign(this.state, newState);
        Object.keys(this.updater).forEach(key => {
            try {
                this.runUpdater(key);
            } catch(e) {
                this.popUpdater(key);
            }
        });
    }

    appendUpdater(name: string, fn: Function) {
        this.updater[name] = fn;
    }

    runUpdater(key: string) {
        this.updater[key]();
    }

    popUpdater(key: string) {
        delete this.updater[key];
    }

    onOpenModal(modalName: ModalName) {
        this.setState({
            [modalName]: true
        });
    }

    onCloseModal(modalName: ModalName) {
        this.setState({
            [modalName]: false
        });
    }
}

export default new Global();