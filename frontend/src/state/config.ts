import cookie from '@modules/cookie';

import { ShareState } from './share-state';

type Theme = 'default' | 'dark' | 'black' | 'neon' | 'pastel';

export interface ConfigState {
    theme: Theme;
    isAutoSave: boolean;
    isOpenNewTab: boolean;
    isSortOldFirst: boolean;
}

class ConfigContext extends ShareState<ConfigState> {
    init: boolean = false;
    state = {
        theme: 'default' as Theme,
        isAutoSave: true,
        isOpenNewTab: false,
        isSortOldFirst: false,
    };

    constructor() {
        super();
        if (typeof window !== 'undefined') {
            this.clientSideInject();
            this.init = true;
        }
    }

    isFirstVisit() {
        const configure = cookie.get('configure');
        if (configure) {
            return false;
        }
        return true;
    }

    clientSideInject() {
        const configure = cookie.get('configure');
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
        cookie.set('configure', JSON.stringify(this.state), {
            path: '/',
            expire: 365,
        });
    }

    afterChangeState() {
        if (this.init) {
            this.configSave();
        }
    }
}

export const configContext = new ConfigContext();