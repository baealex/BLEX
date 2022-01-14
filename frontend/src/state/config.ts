import BState from 'bstate';

import {
    getCookie,
    setCookie,
} from '@modules/utility/cookie';

type Theme = 'default' | 'dark' | 'black' | 'neon' | 'pastel';

export interface ConfigContextState {
    theme: Theme;
    isAutoSave: boolean;
    isOpenNewTab: boolean;
    isSortOldFirst: boolean;
}

class ConfigContext extends BState<ConfigContextState> {
    init: boolean = false;

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
            this.setState((state) => ({
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
            this.setState((state) => ({
                ...state,
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
        document.body.className = '';
        document.body.classList.add(theme);
        this.setState({
            ...this.state,
            theme: theme,
        });
    }

    afterStateChange() {
        if (this.init) {
            this.configSave();
        }
    }
}

export const configContext = new ConfigContext();