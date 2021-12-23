import BState from 'bstate';

import { GetLoginData } from '@modules/api';

export interface AuthContextState extends GetLoginData {
    isLogin: boolean;
}

class AuthContext extends BState<AuthContextState> {
    constructor() {
        super();
        this.state = {
            isLogin: false,
            username: '',
            avatar: '',
            notify: [],
            isTelegramSync: false,
            is2faSync: false,
        };
    }

    logout() {
        this.state = {
            isLogin: false,
            username: '',
            avatar: '',
            notify: [],
            isTelegramSync: false,
            is2faSync: false,
        };
    }
}

export const authContext = new AuthContext();