import BState from 'bstate';

import { GetLoginData } from '@modules/api';

export interface AuthStoreState extends GetLoginData {
    isLogin: boolean;
}

const INIT_STATE = {
    isLogin: false,
    username: '',
    realname: '',
    email: '',
    avatar: '',
    notify: [],
    isFirstLogin: false,
    isTelegramSync: false,
    is2faSync: false,
}

class AuthStore extends BState<AuthStoreState> {
    constructor() {
        super();
        this.state = { ...INIT_STATE };
    }

    logout() {
        this.state = { ...INIT_STATE };
    }
}

export const authStore = new AuthStore();