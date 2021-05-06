import cookie from '@modules/cookie';

type Theme = 'default' | 'dark' | 'deep-dark' | 'neon';

interface GlobalState {
    theme: Theme;
    isFirstVisit: boolean;
    isLogin: boolean;
    username: string;
    isAutoSave: boolean;
    isNightMode: boolean;
    isOpenNewTab: boolean;
    isSortOldFirst: boolean;
    isLoginModalOpen: boolean;
    isSignupModalOpen: boolean;
    isTwoFactorAuthModalOpen: boolean;
}

interface GlobalSetState {
    theme?: Theme;
    isFirstVisit?: boolean;
    isLogin?: boolean;
    username?: string;
    isAutoSave?: boolean;
    isNightMode?: boolean;
    isOpenNewTab?: boolean;
    isSortOldFirst?: boolean;
    isLoginModalOpen?: boolean;
    isSignupModalOpen?: boolean;
    isTwoFactorAuthModalOpen?: boolean;
}

type ModalName = 'isLoginModalOpen' |  'isSignupModalOpen' | 'isTwoFactorAuthModalOpen';

type ConfigName = 'theme' | 'isAutoSave' | 'isNightMode' | 'isOpenNewTab' | 'isSortOldFirst';

class Global {
    init: boolean = false;
    state: GlobalState;
    private updater: any;

    constructor() {
        this.state = {
            theme: 'default',
            isFirstVisit: true,
            isLogin: false,
            username: '',
            isAutoSave: true,
            isNightMode: false,
            isOpenNewTab: false,
            isSortOldFirst: false,
            isLoginModalOpen: false,
            isSignupModalOpen: false,
            isTwoFactorAuthModalOpen: false,
        }
        this.updater = {};
        if(typeof window !== "undefined") {
            this.configInit();
            this.init = true;
        }
    }

    setState(newState: GlobalSetState) {
        Object.assign(this.state, newState);
        Object.keys(this.updater).forEach(key => {
            try {
                this.runUpdater(key);
            } catch(e) {
                this.popUpdater(key);
            }
        });
        if (this.init) {
            Object.keys(newState).forEach(key => {
                if(
                    key === 'theme' ||
                    key === 'isAutoSave' ||
                    key === 'isNightMode' ||
                    key === 'isOpenNewTab' ||
                    key === 'isSortOldFirst'
                ) {
                    this.configSave(key,
                        typeof newState[key] === 'string'
                            ? newState[key] as string
                            : JSON.stringify(newState[key]));
                }
            });
        }
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

    configInit() {
        const theme = cookie.get('theme');
        const isFirstVisit = !theme ? true : false;
        const isAutoSave = cookie.get('isAutoSave') === 'false' ? false : true;
        const isOpenNewTab = cookie.get('isOpenNewTab') === 'true' ? true : false;
        const isSortOldFirst = cookie.get('isSortOldFirst') === 'false' ? false : true;
        
        this.setState({
            theme: theme as Theme || 'default',
            isFirstVisit,
            isAutoSave,
            isOpenNewTab,
            isSortOldFirst
        });
    }

    configInject(cookies: {
        [key: string]: string;
    }) {
        const theme = cookies['theme'] || 'default';
        const isAutoSave = cookies['isAutoSave'] === 'false' ? false : true;
        const isOpenNewTab = cookies['isOpenNewTab'] === 'true' ? true : false;
        const isSortOldFirst = cookies['isSortOldFirst'] === 'false' ? false : true;
        
        this.setState({
            theme: theme as Theme,
            isAutoSave,
            isOpenNewTab,
            isSortOldFirst
        });
    }

    configSave(name: ConfigName, value: string) {
        cookie.set(name, value, {
            path: '/',
            expire: 365,
        });
    }
}

export default new Global();