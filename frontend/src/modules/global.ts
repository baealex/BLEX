interface GlobalState {
    isSettingModalOpen: boolean;
    isLoginModalOpen: boolean;
    isLogin: boolean;
    isNightMode: boolean;
    username: string;
}

type ModalName = 'isSettingModalOpen' | 'isLoginModalOpen';

class Global {
    state: GlobalState;
    private updater: any;

    constructor() {
        this.state = {
            isSettingModalOpen: false,
            isLoginModalOpen: false,
            isLogin: false,
            isNightMode: false,
            username: '',
        }
        this.updater = {};
    }

    setState(newState: GlobalState) {
        this.state = newState;
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
            ...this.state,
            [modalName]: true
        });
    }

    onCloseModal(modalName: ModalName) {
        this.setState({
            ...this.state,
            [modalName]: false
        });
    }
}

export default new Global();