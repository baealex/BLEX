import BState from 'bstate';

import { GetLoginData } from '@modules/api';

export interface AuthContextState extends GetLoginData {
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

class AuthContext extends BState<AuthContextState> {
    constructor() {
        super();
        this.state = { ...INIT_STATE };
    }

    logout() {
        this.state = { ...INIT_STATE };
    }
}

export const authContext = new AuthContext();