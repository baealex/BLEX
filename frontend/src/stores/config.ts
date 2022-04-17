import Store from 'badland';

import {
    getCookie,
    setCookie,
} from '@modules/utility/cookie';

type Theme = 'default' | 'dark' | 'black' | 'neon' | 'pastel';

export interface ConfigStoreState {
    theme: Theme;
    isAutoSave: boolean;
    isOpenNewTab: boolean;
    isSortOldFirst: boolean;
}

class ConfigStore extends Store<ConfigStoreState> {
    init = false;

    constructor() {
        super();
        this.state = {
            theme: 'default' as Theme,
            isAutoSave: true,
            isOpenNewTab: false,
            isSortOldFirst: false,
        };

        if (typeof window !== 'undefined') {
            this.init = true;
            this.clientSideInject();
        }
    }

    isFirstVisit() {
        const configure = getCookie('configure');
        if (configure) {
            return false;
        }
        return true;
    }

    clientSideInject() {
        const configure = getCookie('configure');
        if (configure) {
            this.set((state) => ({
                ...state,
                ...JSON.parse(configure),
            }));
        }
    }

    serverSideInject(cookies: {
        [key: string]: string;
    }) {
        const configure = cookies['configure'];
        if (configure) {
            this.set((prevState) => ({
                ...prevState,
                ...JSON.parse(configure),
            }));
        }
    }

    configSave() {
        setCookie('configure', JSON.stringify(this.state), {
            path: '/',
            expire: 365,
        });
    }

    setTheme(theme: Theme) {
        document.body.className = theme;
        this.set((prevState) => ({
            ...prevState,
            theme: theme,
        }));
    }

    afterStateChange() {
        if (this.init) {
            this.configSave();
        }
    }
}

export const configStore = new ConfigStore();