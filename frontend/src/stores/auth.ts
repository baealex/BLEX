import Store from 'badland';

import type { GetLoginResponseData } from '~/modules/api';

export interface AuthStoreState extends GetLoginResponseData {
    isConfirmed: boolean;
    isLogin: boolean;
}

const INIT_STATE = {
    isConfirmed: false,
    isLogin: false,
    username: '',
    name: '',
    email: '',
    avatar: '',
    notifyCount: 0,
    isFirstLogin: false,
    hasConnectedTelegram: false,
    hasConnected2fa: false,
    hasEditorRole: false
};

class AuthStore extends Store<AuthStoreState> {
    constructor() {
        super();
        this.state = { ...INIT_STATE };
    }

    logout() {
        if (location.pathname.startsWith('/setting')) {
            location.href = '/';
            return;
        }
        this.state = { ...INIT_STATE };
    }
}

export const authStore = new AuthStore();
